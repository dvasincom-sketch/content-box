import { withAuthor, readJson, apiError, apiOk, belongsToTenant } from '@/app/(studio)/studio/api/_lib'
import { slugify } from '@/lib/slugify'
import { parseVideoEmbed, EMBED_PROVIDER_LABEL } from '@/lib/videoEmbed'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Видео из внешней ссылки: VK Видео, VK Клипы, Дзен.
 *
 * Автор вставляет ссылку ИЛИ готовый код `<iframe …>` с площадки. Мы разбираем
 * ввод, проверяем хост по белому списку и сохраняем НОРМАЛИЗОВАННЫЙ src —
 * сырой HTML не хранится и на страницу не попадает (это был бы XSS, а
 * регистрация авторов у нас открытая).
 *
 * Ничего никуда не заливается: файл остаётся на площадке, транскодинг и
 * хранение не наши. Обратная сторона — подписка такое видео не защищает, о чём
 * ответ сообщает флагом `paywallIneffective`, а студия показывает
 * предупреждение.
 *
 * Body: { url, title?, minTierId?, isPreview?, categoryId?, folderId? }
 * Ответ: { ok, id, provider, providerLabel, aspect, paywallIneffective }
 */
export const runtime = 'nodejs'

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const rawUrl = String(data.url || '').trim()
  if (!rawUrl) return apiError('Вставьте ссылку на видео или код вставки')

  const parsed = parseVideoEmbed(rawUrl)
  if (!parsed) {
    return apiError(
      'Не удалось разобрать ссылку. Поддерживаются VK Видео, VK Клипы и Дзен — ' +
        'вставьте ссылку на видео или код из кнопки «Поделиться → Встроить».',
    )
  }

  // Название: своё или подставим по площадке — автор переименует.
  const title = String(data.title || '').trim() || `Видео · ${EMBED_PROVIDER_LABEL[parsed.provider]}`

  // Чужие id проверяем на принадлежность тенанту, как во всех роутах студии.
  const categoryId = numOrNull(data.categoryId)
  if (categoryId != null && !(await belongsToTenant(payload, 'categories', categoryId, tenantId))) {
    return apiError('Категория не найдена')
  }
  const folderId = numOrNull(data.folderId)
  if (folderId != null && !(await belongsToTenant(payload, 'video-folders', folderId, tenantId))) {
    return apiError('Папка не найдена')
  }
  const minTierId = numOrNull(data.minTierId)
  if (minTierId != null && !(await belongsToTenant(payload, 'subscription-tiers', minTierId, tenantId))) {
    return apiError('Уровень подписки не найден')
  }
  // Своя обложка (media). Проверяем принадлежность тенанту.
  const coverId = numOrNull(data.coverId)
  if (coverId != null && !(await belongsToTenant(payload, 'media', coverId, tenantId))) {
    return apiError('Обложка не найдена')
  }

  try {
    const doc = await payload.create({
      collection: 'videos',
      data: {
        title,
        slug: await uniqueSlug(payload, tenantId, slugify(title) || 'video'),
        provider: 'embed',
        embedProvider: parsed.provider,
        embedSrc: parsed.src,
        embedAspect: parsed.aspect,
        minTier: minTierId,
        isPreview: Boolean(data.isPreview),
        ...(coverId != null ? { cover: coverId } : {}),
        category: categoryId,
        season: numOrNull(data.season),
        episode: numOrNull(data.episode),
        ...(Array.isArray(data.tags) && (data.tags as any[]).length
          ? { tags: (data.tags as unknown[]).filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => ({ label: t.trim() })) }
          : {}),
        folder: folderId,
        publishedAt: new Date().toISOString(),
        tenant: tenantId,
        owner: author.user.id,
      } as any,
      overrideAccess: true,
    })

    return apiOk({
      id: doc.id,
      provider: parsed.provider,
      providerLabel: EMBED_PROVIDER_LABEL[parsed.provider],
      aspect: parsed.aspect,
      // Уровень задан, но внешнюю вставку он не закрывает — студия покажет это явно.
      paywallIneffective: minTierId != null && !data.isPreview,
    })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить видео'), 500)
  }
})

/** Свободный slug в пределах тенанта: video, video-2, … */
async function uniqueSlug(payload: any, tenantId: number, base: string): Promise<string> {
  let candidate = base
  for (let n = 1; n < 100; n++) {
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
