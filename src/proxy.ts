import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Роутинг по хосту: платформенный домен vs клиентские (тенантные) домены.
 *
 * ПЛАТФОРМЕННЫЙ домен (contentbox.site, www): на `/` отдаём лендинг платформы
 * (public/landing.html), а /studio и /admin пропускаем как есть — они скоупятся
 * по залогиненному пользователю, тенант по хосту им не нужен.
 *
 * ТЕНАНТНЫЕ хосты — два вида, оба ищут ACTIVE + domainVerified тенанта:
 *  1. ПОДДОМЕН `<sub>.contentbox.site` → по полю `subdomain` (бесплатный
 *     «резервный» адрес автора, всегда доступен, даже если позже подключён
 *     собственный домен). Требует wildcard-DNS `*.contentbox.site` → приложение.
 *  2. СОБСТВЕННЫЙ домен (например bts.example.com) → по полю `domain`.
 *
 * Файл подключается из src/middleware.ts.
 */

const PLATFORM_ROOT = 'contentbox.site'

// Пути мимо резолвинга тенанта (служебные + панели, они скоупятся по логину).
const BYPASS_PREFIXES = ['/admin', '/studio', '/api', '/_next', '/favicon.ico']

// Платформенные хосты: тут лендинг + студия + админка, а НЕ клиентский сайт.
const PLATFORM_HOSTS = new Set([PLATFORM_ROOT, `www.${PLATFORM_ROOT}`])
function isPlatformHost(host: string): boolean {
  // Технический домен Timeweb (*.twc1.net) тоже показывает лендинг — удобно
  // проверить всё ДО переключения DNS на contentbox.site.
  return PLATFORM_HOSTS.has(host) || host.endsWith('.twc1.net')
}

function stripPort(host: string | null): string {
  return (host || '').split(':')[0].toLowerCase()
}

/**
 * Прямой поддомен под `*.contentbox.site` → его метка (напр. `bts`).
 * Возвращает null для платформенных хостов и для многоуровневых имён
 * (`a.b.contentbox.site`) — такие уходят в резолвинг по собственному домену.
 */
function subdomainFromHost(host: string): string | null {
  const suffix = `.${PLATFORM_ROOT}`
  if (!host.endsWith(suffix)) return null
  const sub = host.slice(0, -suffix.length)
  if (!sub || sub === 'www' || sub.includes('.')) return null
  return sub
}

async function resolveTenant(field: 'domain' | 'subdomain', value: string, origin: string) {
  const qs = new URLSearchParams({
    [`where[and][0][${field}][equals]`]: value,
    'where[and][1][status][equals]': 'active',
    'where[and][2][domainVerified][equals]': 'true',
    limit: '1',
    depth: '0',
  })
  const url = `${origin}/api/tenants?${qs.toString()}`
  try {
    const res = await fetch(url, {
      headers: { 'content-type': 'application/json' },
      next: { revalidate: 60, tags: [`tenant:${field}:${value}`] },
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

  // Тенантный хост → резолвинг: поддомен по `subdomain`, иначе по `domain`.
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = `${proto}://${host}`
  const sub = subdomainFromHost(host)
  const tenant = sub
    ? await resolveTenant('subdomain', sub, origin)
    : await resolveTenant('domain', host, origin)

  if (!tenant) {
    // Неизвестный / неверифицированный / приостановленный хост.
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
