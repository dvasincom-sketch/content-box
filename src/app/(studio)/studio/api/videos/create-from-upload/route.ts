import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { slugify } from '@/lib/slugify'
import { streamGetVideo } from '@/lib/cfStream'

/**
 * Создаёт запись Videos после успешной TUS-загрузки. Браузер уже залил файл в
 * Stream и знает uid — здесь мы фиксируем видео в БД.
 *
 * Проверяем, что uid реально существует в Stream (защита от подделки uid).
 *
 * Body: { uid, title, minTierId?, isPreview?, categoryId? }
 */
export const runtime = 'nodejs'

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const uid = String(data.uid || '').trim()
  const title = String(data.title || '').trim()
  if (!uid) return apiError('Нет идентификатора видео')
  if (!title) return apiError('Укажите название')

  // Проверяем, что видео с таким uid реально есть в нашем Stream-аккаунте
  try {
    await streamGetVideo(uid)
  } catch {
    return apiError('Видео не найдено в Stream', 404)
  }

  try {
    const doc = await payload.create({
      collection: 'videos',
      data: {
        title,
        slug: slugify(title) || uid,
        videoRef: uid,
        minTier: numOrNull(data.minTierId),
        isPreview: Boolean(data.isPreview),
        category: numOrNull(data.categoryId),
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })
    return apiOk({ id: doc.id, uid })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось создать запись видео', 500)
  }
})

function numOrNull(v: any): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
