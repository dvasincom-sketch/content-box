import { withAuthor, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { streamSignToken } from '@/lib/cfStream'

/**
 * Данные для просмотра видео АВТОРОМ в студии (превью). Автор всегда имеет
 * доступ к видео своего тенанта — проверки подписки нет, только тенант.
 *
 * Ветвление по провайдеру:
 *   - stream:    signed-токен CF + customerCode
 *   - kinescope: provider + embedId (без токена)
 *
 * GET ?id=<videoDocId>
 * Ответ:
 *   stream    → { ok, provider:'stream', token, uid, customerCode }
 *   kinescope → { ok, provider:'kinescope', embedId }
 */
export const runtime = 'nodejs'

export const GET = withAuthor(async ({ req, payload, tenantId }) => {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return apiError('Не указан id')

  let doc: any
  try {
    doc = await payload.findByID({ collection: 'videos', id, depth: 0, overrideAccess: true })
  } catch {
    return apiError('Видео не найдено', 404)
  }

  const docTenant = doc?.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc?.tenant
  if (Number(docTenant) !== Number(tenantId)) {
    return apiError('Нет доступа', 403)
  }

  const ref = doc.videoRef
  if (!ref) return apiError('У видео нет привязки к хранилищу')

  const provider = doc.provider === 'kinescope' ? 'kinescope' : 'stream'

  // Kinescope: токен не нужен.
  if (provider === 'kinescope') {
    return apiOk({ provider: 'kinescope', embedId: ref })
  }

  // Cloudflare Stream: signed-токен.
  try {
    const token = await streamSignToken(ref, 2 * 60 * 60) // 2 часа
    return apiOk({
      provider: 'stream',
      token,
      uid: ref,
      customerCode: process.env.CF_STREAM_CUSTOMER_CODE || null,
    })
  } catch (e: any) {
    return apiError(`Не удалось подписать токен: ${e?.message || 'ошибка'}`, 500)
  }
})
