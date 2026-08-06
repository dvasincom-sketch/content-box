import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { PLATFORM_ROOT, stripPort, subdomainFromHost } from '@/lib/subdomain'

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
 * В Next.js 16 middleware переименован в proxy: этот файл (`src/proxy.ts`,
 * экспортит `proxy` + `config`) Next подхватывает автоматически по имени.
 * Парсинг хоста (PLATFORM_ROOT, stripPort, subdomainFromHost) — из
 * @/lib/subdomain (общее с серверными роутами; модуль чистый, Edge-совместимый).
 */

// Пути мимо резолвинга тенанта (служебные + панели, они скоупятся по логину).
const BYPASS_PREFIXES = ['/admin', '/studio', '/api', '/_next', '/favicon.ico']

// Платформенные хосты: тут лендинг + студия + админка, а НЕ клиентский сайт.
const PLATFORM_HOSTS = new Set([PLATFORM_ROOT, `www.${PLATFORM_ROOT}`])
function isPlatformHost(host: string): boolean {
  // Технический домен Timeweb (*.twc1.net) тоже показывает лендинг — удобно
  // проверить всё ДО переключения DNS на contentbox.site.
  return PLATFORM_HOSTS.has(host) || host.endsWith('.twc1.net')
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

// Локальные хосты дев-сервера.
function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost')
}

/**
 * DEV-ONLY: резолвинг тенанта для локальных хостов (`localhost`, `*.localhost`).
 *
 * Прод-путь (`resolveTenant`) в локали нежизнеспособен: origin собирается из
 * host БЕЗ порта и по `https`, а ещё требует `domainVerified=true`. Здесь:
 *  • фетчим сам dev-сервер по loopback с реальным портом (DNS `*.localhost`
 *    из Node не резолвится — 127.0.0.1 надёжнее);
 *  • НЕ требуем `domainVerified`;
 *  • пробуем сопоставить метку поддомена (`bts.localhost` → subdomain `bts`),
 *    затем host как `domain`, затем — первый активный тенант (чтобы работал и
 *    голый `localhost:3000`).
 * Никогда не вызывается в production (см. гард в proxy()).
 */
async function resolveDevTenant(host: string, port: string) {
  const origin = `http://127.0.0.1:${port || '3000'}`
  const fetchOne = async (params: Record<string, string>) => {
    const qs = new URLSearchParams({ limit: '1', depth: '0', ...params })
    try {
      const res = await fetch(`${origin}/api/tenants?${qs.toString()}`, {
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
      })
      if (!res.ok) return null
      const data = await res.json()
      return data?.docs?.[0] || null
    } catch {
      return null
    }
  }

  const label = host.endsWith('.localhost')
    ? host.slice(0, -'.localhost'.length).split('.').pop() || ''
    : ''

  if (label) {
    const bySub = await fetchOne({
      'where[and][0][subdomain][equals]': label,
      'where[and][1][status][equals]': 'active',
    })
    if (bySub) return bySub
    const byDomain = await fetchOne({
      'where[and][0][domain][equals]': host,
      'where[and][1][status][equals]': 'active',
    })
    if (byDomain) return byDomain
  }

  // Фолбэк: первый активный тенант.
  return await fetchOne({ 'where[status][equals]': 'active' })
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Заголовки тенанта — ДОВЕРЕННЫЕ: их ставит только этот прокси, и только
  // после успешного резолвинга по хосту. Всё, что пришло с ними от клиента,
  // срезаем до любой другой логики. Иначе на байпас-путях (/api, /admin,
  // /studio), на платформенном домене и на нерезолвнутом хосте клиентский
  // `x-tenant-id` доезжал бы до серверного кода как настоящий.
  const safeHeaders = new Headers(request.headers)
  safeHeaders.delete('x-tenant-id')
  safeHeaders.delete('x-tenant-domain')
  const passthrough = () => NextResponse.next({ request: { headers: safeHeaders } })

  if (BYPASS_PREFIXES.some((p) => pathname.startsWith(p))) {
    return passthrough()
  }

  const host = stripPort(
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.hostname,
  )

  // DEV-ONLY: локальные хосты (localhost, *.localhost) → тенант без требования
  // verified, фетч по loopback. В production ветка выключена и не влияет на
  // обычный резолвинг по домену/поддомену.
  if (process.env.NODE_ENV !== 'production' && isLocalHost(host)) {
    const tenant = await resolveDevTenant(host, request.nextUrl.port)
    if (tenant) {
      safeHeaders.set('x-tenant-id', String(tenant.id))
      safeHeaders.set('x-tenant-domain', host)
      return NextResponse.next({ request: { headers: safeHeaders } })
    }
    // Тенантов нет вовсе → падаем в обычную ветку (покажет /domain-not-found).
  }

  // Платформенный домен: лендинг на `/`, без резолвинга тенанта.
  if (isPlatformHost(host)) {
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/landing.html' // статика из public/
      // Заголовки очищенные и здесь: если лендинг когда-нибудь переедет из
      // public/ в роутер, rewrite не должен донести клиентский x-tenant-id.
      return NextResponse.rewrite(url, { request: { headers: safeHeaders } })
    }
    // Журнал обновлений — статическая страница в стиле лендинга, чистый адрес.
    if (pathname === '/update' || pathname === '/update/') {
      const url = request.nextUrl.clone()
      url.pathname = '/update.html'
      return NextResponse.rewrite(url, { request: { headers: safeHeaders } })
    }
    // Прочие пути (кроме уже пропущенных /studio, /admin, /api) — как есть.
    return passthrough()
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
    // Заголовки идут очищенными: иначе клиент подделал бы тенант на хосте,
    // который вообще не резолвится.
    const url = request.nextUrl.clone()
    url.pathname = '/domain-not-found'
    const res = NextResponse.rewrite(url, { request: { headers: safeHeaders } })
    res.headers.set('x-tenant-status', 'unresolved')
    return res
  }

  // Канонический адрес: тенант открыт по бесплатному поддомену (*.contentbox.site),
  // но у него подключён собственный домен — 301 на него. Единый канонический хост
  // = без дублей контента для SEO. Для собственного домена subdomainFromHost
  // вернёт null, поэтому редирект-петли не будет.
  if (sub && tenant.domain && !tenant.domain.endsWith(`.${PLATFORM_ROOT}`)) {
    const target = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      `https://${tenant.domain}`,
    )
    return NextResponse.redirect(target, 301)
  }

  safeHeaders.set('x-tenant-id', String(tenant.id))
  safeHeaders.set('x-tenant-domain', host)

  const res = NextResponse.next({ request: { headers: safeHeaders } })
  // Внутренний id тенанта в ОТВЕТ не отдаём — это была утечка «карты» платформы,
  // а клиентского потребителя у этих заголовков нет.
  // Ключ кэширования — хост, а не заголовок, который клиент не присылает:
  // прежний `Vary: x-tenant-domain` не защищал от отдачи HTML тенанта A на
  // домене B промежуточным кэшем.
  res.headers.set('Vary', 'Host, X-Forwarded-Host')
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
