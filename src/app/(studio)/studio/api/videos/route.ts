import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { slugify } from '@/lib/slugify'
import { streamCopyFromUrl } from '@/lib/cfStream'

/**
 * Создание видео из внешней ссылки (Яндекс Object Storage и т.п.).
 * Cloudflare Stream сам скачивает файл по URL — мы ничего не проксируем.
 *
 * Поток: валидируем → Stream /copy (requireSignedURLs=true) → получаем uid →
 * создаём запись Videos с videoRef=uid и статусом «кодируется» (readyToStream
 * приходит false; готовность проверяем отдельным роутом status).
 *
 * Body: { title, url, minTierId?, isPreview?, categoryId? }
 */
export const runtime = 'nodejs'

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const title = String(data.title || '').trim()
  const url = String(data.url || '').trim()

  if (!title) return apiError('Укажите название')
  if (!isHttpUrl(url)) {
    return apiError('Укажите прямую ссылку на видеофайл (http/https)')
  }

  // 1) Запускаем копирование в Stream
  let uid: string
  try {
    const video = await streamCopyFromUrl({
      url,
      name: title,
      requireSignedURLs: true, // защищаем сразу — публично по uid не открыть
    })
    uid = video.uid
  } catch (e: any) {
    return apiError(`Cloudflare Stream: ${e?.message || 'не удалось начать загрузку'}`, 502)
  }

  // 2) Создаём запись Videos с uid в videoRef
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
    return apiError(e?.message || 'Видео ушло в Stream, но запись создать не удалось', 500)
  }
})

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
function numOrNull(v: any): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
