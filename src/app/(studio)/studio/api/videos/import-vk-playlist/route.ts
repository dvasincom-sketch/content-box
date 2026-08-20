import { withAuthor, readJson, apiError, apiOk, belongsToTenant, authorCan } from '@/app/(studio)/studio/api/_lib'
import { slugify } from '@/lib/slugify'
import { parseVideoEmbed } from '@/lib/videoEmbed'
import { checkEmbedAvailability } from '@/lib/vkValidate'
import { parseVkPlaylistUrl, fetchVkPlaylist, vkTokenConfigured, type VkVideoItem } from '@/lib/vkPlaylist'
import { shrinkForWeb, storageName } from '@/lib/imageIngest'
import { logActivity } from '@/lib/logActivity'

/**
 * Бустрый импорт плейлиста VK Видео в категорию. Видео НЕ храним у себя —
 * создаём embed-записи (плеер VK через iframe), как ручное добавление ссылки.
 * Обложку скачиваем один раз и кладём в наш R2 (media). Дедуп по externalRef
 * (`vk:<owner>_<id>`): повторный запуск добавляет только новые.
 *
 * Body: { playlistUrl, categoryId }
 * Ответ: { ok, added, skipped, unavailable, total }
 */
export const runtime = 'nodejs'

const MAX_COVER_BYTES = 8 * 1024 * 1024

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'videos', 'create')) return apiError('Недостаточно прав', 403)

  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const ref = parseVkPlaylistUrl(String(data.playlistUrl || ''))
  if (!ref) return apiError('Не удалось разобрать ссылку на плейлист VK (нужен вид …/playlist/-217576166_30).')

  const categoryId = numOrNull(data.categoryId)
  if (categoryId == null) return apiError('Выберите категорию для импорта')
  if (!(await belongsToTenant(payload, 'categories', categoryId, tenantId))) return apiError('Категория не найдена')

  // Строгая проверка доступности каждого ролика (медленнее). Без неё статус
  // ставим 'ok' по факту наличия в плейлисте (токен его прочитал).
  const verify = data.verify === true

  if (!vkTokenConfigured()) return apiError('На сервере не задан VK_SERVICE_TOKEN — импорт из VK недоступен.', 503)

  const playlist = await fetchVkPlaylist(ref)
  if (!playlist.ok) return apiError(playlist.error, 502)
  const items = playlist.items
  if (items.length === 0) return apiOk({ added: 0, skipped: 0, unavailable: 0, total: 0 })

  // Дедуп: одним запросом достаём уже существующие externalRef этого тенанта.
  const refs = items.map((it) => extRef(it))
  const existingRes = await payload.find({
    collection: 'videos',
    where: { and: [{ tenant: { equals: tenantId } }, { externalRef: { in: refs } }] },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  const existing = new Set<string>((existingRes.docs as any[]).map((d) => String(d.externalRef)))

  let added = 0
  let skipped = 0
  let unavailable = 0

  for (const it of items) {
    const externalRef = extRef(it)
    if (existing.has(externalRef)) {
      skipped++
      continue
    }

    // Нормализуем плеер через белый список хостов; фолбэк — ссылка на видео.
    const parsed =
      parseVideoEmbed(it.player) ||
      parseVideoEmbed(`https://vk.com/video${it.ownerId}_${it.videoId}`)
    if (!parsed) {
      unavailable++
      continue
    }

    let coverId: number | string | null = null
    try {
      coverId = await ingestCover(payload, tenantId, it.imageUrl, it.title)
    } catch {
      coverId = null // обложка не критична
    }

    const embedStatus = verify ? await checkEmbedAvailability(parsed.src) : 'ok'

    try {
      const title = it.title || `Видео · VK`
      await payload.create({
        collection: 'videos',
        data: {
          title,
          slug: await uniqueSlug(payload, tenantId, slugify(title) || 'video'),
          provider: 'embed',
          embedProvider: parsed.provider,
          embedSrc: parsed.src,
          embedAspect: parsed.aspect,
          embedStatus,
          embedCheckedAt: new Date().toISOString(),
          description: it.description || undefined,
          durationSec: it.durationSec || undefined,
          category: categoryId,
          cover: coverId,
          externalRef,
          publishedAt: it.dateSec ? new Date(it.dateSec * 1000).toISOString() : new Date().toISOString(),
          tenant: tenantId,
          owner: author.user.id,
        } as any,
        overrideAccess: true,
      })
      existing.add(externalRef)
      added++
    } catch {
      unavailable++
    }
  }

  try {
    await logActivity(payload, {
      tenant: tenantId,
      user: author.user.id,
      action: 'create',
      entity: 'видео',
      title: `Импорт плейлиста VK: +${added}`,
    })
  } catch {
    /* лог не критичен */
  }

  return apiOk({ added, skipped, unavailable, total: items.length })
})

function extRef(it: VkVideoItem): string {
  return `vk:${it.ownerId}_${it.videoId}`
}

/** Скачать превью VK и положить в media (R2). null — если не вышло. */
async function ingestCover(
  payload: any,
  tenantId: number,
  url: string | null,
  title: string,
): Promise<number | string | null> {
  if (!url) return null
  const res = await fetch(url, { signal: AbortSignal.timeout(12000), cache: 'no-store' })
  if (!res.ok) return null
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!type.startsWith('image/')) return null
  const raw = Buffer.from(await res.arrayBuffer())
  if (raw.length === 0 || raw.length > MAX_COVER_BYTES) return null
  const ing = await shrinkForWeb(raw, type)
  const media = await payload.create({
    collection: 'media',
    data: { tenant: tenantId, alt: title || 'Обложка' } as any,
    file: {
      data: ing.buffer,
      name: storageName(tenantId, title || 'cover', ing.ext, 'cover'),
      mimetype: ing.mime,
      size: ing.buffer.length,
    },
    overrideAccess: true,
  })
  return media?.id ?? null
}

/** Свободный slug в пределах тенанта: video, video-2, … */
async function uniqueSlug(payload: any, tenantId: number, base: string): Promise<string> {
  let candidate = base
  for (let n = 1; n < 200; n++) {
    const res = await payload.find({
      collection: 'videos',
      where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: candidate } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (res.totalDocs === 0) return candidate
    candidate = `${base}-${n + 1}`
  }
  return `${base}-${Date.now()}`
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
