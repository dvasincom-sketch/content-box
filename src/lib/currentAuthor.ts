import { getPayload } from 'payload'
import { headers as getHeaders } from 'next/headers.js'
import config from '@/payload.config'

/**
 * Текущий залогиненный АВТОР (владелец тенанта) на серверной стороне.
 *
 * Аналог currentSubscriber.ts, но для коллекции `users` (админ-панельная auth).
 * Читает httpOnly-cookie через payload.auth. Возвращает user ТОЛЬКО если:
 *   - он из коллекции users (не subscriber),
 *   - у него есть привязка к тенанту (tenantRole-плоскость, не superadmin).
 *
 * Superadmin (platformRole: 'superadmin', tenant: null) как «автор» НЕ проходит —
 * у него нет своего тенанта для скоупинга публикаций. Если позже понадобится
 * пускать суперадмина в студию под выбранный тенант — обрабатывать отдельно.
 *
 * Возвращает { user, tenantId } либо null.
 */
export async function getCurrentAuthor() {
  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })

    if (!user || (user as any).collection !== 'users') return null

    // tenant может прийти как id (number) или как populated-объект
    const rawTenant = (user as any).tenant
    const tenantId =
      rawTenant && typeof rawTenant === 'object' ? rawTenant.id : rawTenant

    if (!tenantId) return null

    return { user: user as any, tenantId: tenantId as number }
  } catch {
    return null
  }
}
