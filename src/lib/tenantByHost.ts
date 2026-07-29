import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import { stripPort, subdomainFromHost } from '@/lib/subdomain'

/**
 * Доверенный резолвинг тенанта ПО ХОСТУ запроса.
 *
 * Зачем отдельный модуль: `proxy.ts` не обрабатывает `/api/*` (см. BYPASS_PREFIXES),
 * поэтому на этих путях заголовка `x-tenant-id` нет — и полагаться на него нельзя,
 * он пришёл бы прямо от клиента. Публичные роуты под `/api/*` (поиск, video-token)
 * обязаны резолвить тенанта сами, из Host, и только так.
 *
 * Повторяет правила proxy.ts: сначала метка поддомена (`<sub>.contentbox.site`),
 * иначе собственный домен; в обоих случаях требуется ACTIVE + domainVerified.
 */
export async function tenantIdByHost(host: string): Promise<string | null> {
  const h = stripPort(host)
  if (!h) return null
  const payload = await getPayload({ config })

  const findOne = async (and: Where[]) => {
    const res = await payload.find({
      collection: 'tenants',
      where: { and },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return res.docs[0] ? String(res.docs[0].id) : null
  }

  // DEV-ONLY: локальные хосты, как в resolveDevTenant() из proxy.ts — без
  // требования domainVerified и с фолбэком на первого активного тенанта.
  // Без этой ветки на localhost роуты под /api/* (video-token, поиск) не
  // резолвили бы тенанта вовсе, хотя страницы рендерятся нормально.
  if (process.env.NODE_ENV !== 'production' && isLocalHost(h)) {
    const label = h.endsWith('.localhost')
      ? h.slice(0, -'.localhost'.length).split('.').pop() || ''
      : ''
    if (label) {
      const bySub = await findOne([{ subdomain: { equals: label } }, { status: { equals: 'active' } }])
      if (bySub) return bySub
      const byDomain = await findOne([{ domain: { equals: h } }, { status: { equals: 'active' } }])
      if (byDomain) return byDomain
    }
    return findOne([{ status: { equals: 'active' } }])
  }

  const sub = subdomainFromHost(h)
  // Типизируем как Where[], чтобы каждое условие проверялось отдельно
  // (иначе TS расширяет ветки тернарника в несовместимый union).
  const and: Where[] = [
    sub ? { subdomain: { equals: sub } } : { domain: { equals: h } },
    { status: { equals: 'active' } },
    { domainVerified: { equals: true } },
  ]
  return findOne(and)
}

function isLocalHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host.endsWith('.localhost')
  )
}

/** Тенант по заголовкам запроса — только Host, заголовок x-tenant-id игнорируется. */
export async function tenantIdFromRequestHeaders(hdrs: Headers): Promise<string | null> {
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? ''
  return tenantIdByHost(host)
}
