import { withAuthor, readJson, apiError, apiOk, authorCan } from '@/app/(studio)/studio/api/_lib'
import { slugify } from '@/lib/slugify'
import { enqueueTranscode } from '@/lib/videoJobs'
import { isYandexDiskUrl, yandexPublicMeta } from '@/lib/yandexDisk'
import { errorMessage } from '@/lib/errorMessage'
import { MIN_VIDEO_TIER_PRICE, tierPrice } from '@/lib/videoPricing'
import { randomBytes } from 'crypto'

/**
 * Импорт своего видео (provider='self') по публичной ссылке Яндекс.Диска —
 * без скачивания на устройство. Проверяем ссылку и метаданные, создаём запись
 * (assetStatus='processing') и ставим задачу транскода с source_url. Оригинал
 * воркер скачает напрямую из Яндекса и прогонит через FFmpeg.
 *
 * Своё видео обязательно платное — minTierId требуется.
 *
 * Body: { url, title, minTierId, categoryId?, season?, episode?, tags? }
 */
export const runtime = 'nodejs'

const MAX_BYTES = 30 * 1024 * 1024 * 1024 // 30 ГБ

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'videos', 'create')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const url = String(data.url || '').trim()
  const title = String(data.title || '').trim()
  const minTierId = numOrNull(data.minTierId)
  if (!url) return apiError('Вставьте ссылку на Яндекс.Диск')
  if (!isYandexDiskUrl(url)) return apiError('Поддерживаются публичные ссылки Яндекс.Диска (disk.yandex.ru/...)')
  if (!title) return apiError('Укажите название')
  if (minTierId == null) return apiError('Выберите уровень доступа — своё видео доступно только по подписке')
  const price = await tierPrice(payload, minTierId, tenantId)
  if (price == null) return apiError('Выбранный уровень доступа не найден')
  if (price < MIN_VIDEO_TIER_PRICE) {
    return apiError(`Для видео нужен тариф от ${MIN_VIDEO_TIER_PRICE} ₽/мес — поднимите цену уровня или выберите подходящий.`)
  }

  // Проверяем, что ссылка доступна и указывает на файл (а не папку).
  const meta = await yandexPublicMeta(url)
  if (!meta) return apiError('Не удалось открыть ссылку — проверьте, что доступ публичный', 400)
  if (meta.type !== 'file') return apiError('Ссылка ведёт на папку — нужна ссылка на один видеофайл', 400)
  if (meta.size > MAX_BYTES) return apiError('Файл больше 30 ГБ', 400)

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
        minTier: minTierId,
        category: numOrNull(data.categoryId),
        season: numOrNull(data.season),
        episode: numOrNull(data.episode),
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

    const settingsRes = await payload.find({ collection: 'site-settings', where: { tenant: { equals: tenantId } }, limit: 1, depth: 0, overrideAccess: true })
    const profile = String((settingsRes.docs[0] as any)?.videoProfile || 'balanced')
    await enqueueTranscode(payload, { videoId: doc.id, tenantId, playbackId, sourceUrl: url, profile })
    return apiOk({ id: doc.id, playbackId })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось создать запись видео'), 500)
  }
})
