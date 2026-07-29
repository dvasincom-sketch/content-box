import { headers as nextHeaders } from 'next/headers'
import { tenantIdByHost, tenantIdFromRequestHeaders } from '@/lib/tenantByHost'

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
 * TODO: viewerTier пока 0 (аноним). Сюда нужно подставить вес активного тарифа
 * залогиненного подписчика, чтобы оплаченный контент не помечался закрытым.
 */
export async function resolveViewerTenantSSR(): Promise<ViewerTenant | null> {
  const hdrs = await nextHeaders()
  const fromProxy = hdrs.get('x-tenant-id')
  if (fromProxy) return { id: fromProxy, viewerTier: 0 }

  // Фолбэк на случай, если страницу отрисовали вне обычного прокси-пути.
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? ''
  const id = await tenantIdByHost(host)
  return id ? { id, viewerTier: 0 } : null
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
  return id ? { id, viewerTier: 0 } : null
}
