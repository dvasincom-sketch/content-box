import { withAuthor, readJson, apiError, apiOk, authorCan } from '@/app/(studio)/studio/api/_lib'
import { slugify } from '@/lib/slugify'
import { headObject } from '@/lib/s3'
import { enqueueTranscode } from '@/lib/videoJobs'
import { errorMessage } from '@/lib/errorMessage'
import { MIN_VIDEO_TIER_PRICE, tierPrice } from '@/lib/videoPricing'
import { randomBytes } from 'crypto'

/**
 * Шаг 2 загрузки своего видео (provider='self'): после заливки оригинала в S3
 * фиксируем запись Videos (assetStatus='processing') и ставим задачу транскода
 * в очередь video_jobs. Воркер подхватит её и пришлёт webhook asset.ready.
 *
 * Своё видео обязано быть платным — minTierId требуется (см. правило доступа).
 *
 * Body: { key, title, minTierId, categoryId?, season?, episode?, tags?, durationSec? }
 * Ответ: { ok, id, playbackId }
 */
export const runtime = 'nodejs'

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'videos', 'create')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const key = String(data.key || '').trim()
  const title = String(data.title || '').trim()
  const minTierId = numOrNull(data.minTierId)
  if (!key) return apiError('Нет ключа загруженного файла')
  if (!title) return apiError('Укажите название')
  if (minTierId == null) {
    return apiError('Выберите уровень доступа — своё видео доступно только по подписке')
  }
  const price = await tierPrice(payload, minTierId, tenantId)
  if (price == null) return apiError('Выбранный уровень доступа не найден')
  if (price < MIN_VIDEO_TIER_PRICE) {
    return apiError(`Для видео нужен тариф от ${MIN_VIDEO_TIER_PRICE} ₽/мес — поднимите цену уровня или выберите подходящий.`)
  }

  // Убеждаемся, что файл реально залит в S3 (защита от подделки key).
  const head = await headObject(key)
  if (!head) return apiError('Файл не найден в хранилище — загрузка не завершилась', 404)

  const playbackId = randomBytes(12).toString('hex')

  try {
    const doc = await payload.create({
      collection: 'videos',
      data: {
        title,
        slug: slugify(title) || playbackId,
        provider: 'self',
        assetStatus: 'processing',
        playbackId,
        originalKey: key,
        minTier: minTierId,
        category: numOrNull(data.categoryId),
        season: numOrNull(data.season),
        episode: numOrNull(data.episode),
        durationSec: numOrNull(data.durationSec),
        ...(Array.isArray(data.tags) && (data.tags as unknown[]).length
          ? {
              tags: (data.tags as unknown[])
                .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
                .map((t) => ({ label: t.trim() })),
            }
          : {}),
        tenant: tenantId,
        owner: author.user.id,
      } as any,
      overrideAccess: true,
    })

    await enqueueTranscode(payload, {
      videoId: doc.id,
      tenantId,
      playbackId,
      originalKey: key,
    })

    return apiOk({ id: doc.id, playbackId })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось создать запись видео'), 500)
  }
})
