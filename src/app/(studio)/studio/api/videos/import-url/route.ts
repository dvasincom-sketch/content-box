import { withAuthor, readJson, apiError, apiOk, authorCan } from '@/app/(studio)/studio/api/_lib'
import { slugify } from '@/lib/slugify'
import { enqueueTranscode } from '@/lib/videoJobs'
import { isYandexDiskUrl, yandexPublicMeta } from '@/lib/yandexDisk'
import { errorMessage } from '@/lib/errorMessage'
import { MIN_VIDEO_TIER_PRICE, tierPrice } from '@/lib/videoPricing'
import { randomBytes } from 'crypto'

/**
 * Импорт своего видео (provider='self') по публичным ссылкам Яндекс.Диска —
 * без скачивания на устройство. Поддерживается СПИСОК ссылок: название каждого
 * видео подтягивается из имени файла на Диске. Для каждой ссылки проверяем
 * метаданные, создаём запись (assetStatus='processing') и ставим задачу
 * транскода с source_url — оригинал воркер скачает напрямую из Яндекса.
 *
 * Своё видео обязательно платное — minTierId требуется.
 *
 * Body:
 *   { urls: string[], minTierId, categoryId?, season?, episode?, tags? }  — пачка
 *   { url, title?, minTierId, ... }                                        — одиночная (совместимость)
 * Ответ: { created: [{id, title, url}], errors: [{url, error}], count, id }
 */
export const runtime = 'nodejs'

const MAX_BYTES = 30 * 1024 * 1024 * 1024 // 30 ГБ
const MAX_BATCH = 50

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Имя файла без расширения → человекочитаемое название. */
function titleFromFilename(name: string): string {
  return String(name || '').replace(/\.[^.]+$/, '').trim()
}

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'videos', 'create')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  // Список ссылок: либо urls[] (пачка), либо одиночный url (совместимость).
  const rawUrls: string[] = Array.isArray(data.urls)
    ? (data.urls as unknown[]).map((u) => String(u || '').trim())
    : [String(data.url || '').trim()]
  const urls = Array.from(new Set(rawUrls.filter(Boolean))) // без пустых и дублей
  if (urls.length === 0) return apiError('Вставьте ссылку на Яндекс.Диск')
  if (urls.length > MAX_BATCH) return apiError(`За один раз можно добавить не больше ${MAX_BATCH} ссылок`)

  const minTierId = numOrNull(data.minTierId)
  if (minTierId == null) return apiError('Выберите уровень доступа — своё видео доступно только по подписке')
  const price = await tierPrice(payload, minTierId, tenantId)
  if (price == null) return apiError('Выбранный уровень доступа не найден')
  if (price < MIN_VIDEO_TIER_PRICE) {
    return apiError(`Для видео нужен тариф от ${MIN_VIDEO_TIER_PRICE} ₽/мес — поднимите цену уровня или выберите подходящий.`)
  }

  // Явное название учитываем только для одиночной ссылки; для пачки — из имени файла.
  const explicitTitle = urls.length === 1 ? String(data.title || '').trim() : ''

  // Общие метаданные — применяются ко всем видео из списка.
  const season = numOrNull(data.season)
  const episodeBase = numOrNull(data.episode)
  const categoryId = numOrNull(data.categoryId)
  const tagRows = Array.isArray(data.tags)
    ? (data.tags as unknown[])
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => ({ label: t.trim() }))
    : []

  // Профиль сжатия — читаем один раз.
  const settingsRes = await payload.find({ collection: 'site-settings', where: { tenant: { equals: tenantId } }, limit: 1, depth: 0, overrideAccess: true })
  const profile = String((settingsRes.docs[0] as any)?.videoProfile || 'balanced')
  const renditionHeights = String((settingsRes.docs[0] as any)?.videoRenditions || '480,720')

  const created: { id: number | string; title: string; url: string }[] = []
  const errors: { url: string; error: string }[] = []

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    try {
      if (!isYandexDiskUrl(url)) { errors.push({ url, error: 'Не ссылка Яндекс.Диска' }); continue }
      const meta = await yandexPublicMeta(url)
      if (!meta) { errors.push({ url, error: 'Ссылка недоступна — нужен публичный доступ' }); continue }
      if (meta.type !== 'file') { errors.push({ url, error: 'Ссылка ведёт на папку, а не на файл' }); continue }
      if (meta.size > MAX_BYTES) { errors.push({ url, error: 'Файл больше 30 ГБ' }); continue }

      const title = explicitTitle || titleFromFilename(meta.name) || `Видео ${i + 1}`
      const playbackId = randomBytes(12).toString('hex')

      const doc = await payload.create({
        collection: 'videos',
        data: {
          title,
          slug: slugify(title) || playbackId,
          provider: 'self',
          assetStatus: 'processing',
          playbackId,
          minTier: minTierId,
          category: categoryId,
          season,
          episode: episodeBase != null ? episodeBase + i : null,
          ...(tagRows.length ? { tags: tagRows } : {}),
          tenant: tenantId,
          owner: author.user.id,
        } as any,
        overrideAccess: true,
      })

      await enqueueTranscode(payload, { videoId: doc.id, tenantId, playbackId, sourceUrl: url, profile, renditionHeights })
      created.push({ id: doc.id, title, url })
    } catch (e: unknown) {
      errors.push({ url, error: errorMessage(e, 'Не удалось создать запись') })
    }
  }

  if (created.length === 0) {
    // Ни одно не удалось — вернём первую ошибку понятным сообщением.
    return apiError(errors[0]?.error || 'Не удалось импортировать видео', 400)
  }

  // Совместимость с одиночным вызовом: отдаём id первого.
  return apiOk({ created, errors, count: created.length, id: created[0].id })
})
