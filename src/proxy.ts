import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Роутинг по хосту: платформенный домен vs клиентские (тенантные) домены.
 *
 * ПЛАТФОРМЕННЫЙ домен (contentbox.site): на `/` отдаём лендинг платформы
 * (public/landing.html), а /studio и /admin пропускаем как есть — они скоупятся
 * по залогиненному пользователю, тенант по хосту им не нужен.
 *
 * КЛИЕНТСКИЕ домены: ищем ACTIVE + domainVerified тенанта по `domain` через
 * Payload REST API и инжектим его контекст в заголовки (рендер и запросы идут
 * в скоупе тенанта). ISR/CDN кэш варьируется по домену.
 *
 * Файл подключается из src/middleware.ts.
 */

// Пути мимо резолвинга тенанта (служебные + панели, они скоупятся по логину).
const BYPASS_PREFIXES = ['/admin', '/studio', '/api', '/_next', '/favicon.ico']

// Платформенные хосты: тут лендинг + студия + админка, а НЕ клиентский сайт.
const PLATFORM_HOSTS = new Set(['contentbox.site', 'www.contentbox.site'])
function isPlatformHost(host: string): boolean {
  // Технический домен Timeweb (*.twc1.net) тоже показывает лендинг — удобно
  // проверить всё ДО переключения DNS на contentbox.site.
  return PLATFORM_HOSTS.has(host) || host.endsWith('.twc1.net')
}

function stripPort(host: string | null): string {
  return (host || '').split(':')[0].toLowerCase()
}

async function resolveTenantByDomain(domain: string, origin: string) {
  const qs = new URLSearchParams({
    'where[and][0][domain][equals]': domain,
    'where[and][1][status][equals]': 'active',
    'where[and][2][domainVerified][equals]': 'true',
    limit: '1',
    depth: '0',
  })
  const url = `${origin}/api/tenants?${qs.toString()}`
  try {
    const res = await fetch(url, {
      headers: { 'content-type': 'application/json' },
      next: { revalidate: 60, tags: [`tenant:${domain}`] },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.docs?.[0] || null
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (BYPASS_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const host = stripPort(
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.hostname,
  )

  // Платформенный домен: лендинг на `/`, без резолвинга тенанта.
  if (isPlatformHost(host)) {
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/landing.html' // статика из public/
      return NextResponse.rewrite(url)
    }
    // Прочие пути (кроме уже пропущенных /studio, /admin, /api) — как есть.
    return NextResponse.next()
  }

  // Клиентский домен → резолвинг тенанта.
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = `${proto}://${host}`
  console.log('[proxy] host=', host, '| origin=', origin)
  const tenant = await resolveTenantByDomain(host, origin)

  if (!tenant) {
    // Неизвестный / неверифицированный / приостановленный домен.
    const url = request.nextUrl.clone()
    url.pathname = '/domain-not-found'
    const res = NextResponse.rewrite(url)
    res.headers.set('x-tenant-status', 'unresolved')
    return res
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant-id', String(tenant.id))
  requestHeaders.set('x-tenant-domain', host)

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set('x-tenant-id', String(tenant.id))
  res.headers.set('x-tenant-domain', host)
  res.headers.set('Vary', 'x-tenant-domain')
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
