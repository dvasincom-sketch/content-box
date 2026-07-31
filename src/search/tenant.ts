import { headers as nextHeaders } from 'next/headers'
import { tenantIdByHost, tenantIdFromRequestHeaders } from '@/lib/tenantByHost'
import { getViewerTierWeight } from '@/lib/viewerTier'

export type ViewerTenant = {
  id: string
  /** Access weight of the current viewer. 0 = anonymous / free. */
  viewerTier: number
}

/**
 * Тенант для SSR-страницы поиска.
 *
 * Здесь `x-tenant-id` доверенный: путь `/search` прокси обрабатывает, а сам
 * прокси срезает одноимённый заголовок клиента до любой другой логики
 * (см. proxy.ts) и ставит свой только после успешного резолвинга по хосту.
 *
 * viewerTier — вес активного тарифа залогиненного подписчика (0 у гостя), чтобы
 * оплаченный контент не помечался в выдаче закрытым. См. getViewerTierWeight.
 */
export async function resolveViewerTenantSSR(): Promise<ViewerTenant | null> {
  const hdrs = await nextHeaders()
  const fromProxy = hdrs.get('x-tenant-id')
  if (fromProxy) return { id: fromProxy, viewerTier: await getViewerTierWeight(fromProxy) }

  // Фолбэк на случай, если страницу отрисовали вне обычного прокси-пути.
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? ''
  const id = await tenantIdByHost(host)
  return id ? { id, viewerTier: await getViewerTierWeight(id) } : null
}

/**
 * Тенант для роутов под `/api/*`.
 *
 * Раньше эта ветка тоже начиналась с `hdrs.get('x-tenant-id')` — и это была
 * дыра: `/api` входит в BYPASS_PREFIXES прокси, поэтому заголовок приходил
 * напрямую от клиента. `curl -H 'x-tenant-id: 7' …/api/search?q=a` отдавал
 * контент чужого тенанта, включая неактивных и неверифицированных. Резолвим
 * только по Host.
 */
export async function resolveViewerTenantFromRequest(
  reqHeaders: Headers,
): Promise<ViewerTenant | null> {
  const id = await tenantIdFromRequestHeaders(reqHeaders)
  return id ? { id, viewerTier: await getViewerTierWeight(id) } : null
}
