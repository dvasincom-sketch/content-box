import { withAuthor, readJson, apiError, apiOk, belongsToTenant, hasCapability, authorCan } from '@/app/(studio)/studio/api/_lib'
import { headObject, publicUrl } from '@/lib/s3'
import { slugify } from '@/lib/slugify'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Шаг 2 presigned-загрузки аудио: файл уже в S3 (ключ из presign). Проверяем,
 * что объект существует и принадлежит тенанту (префикс ключа), затем создаём
 * запись Videos (provider='audio', audioSrc = публичный URL). Байты не трогаем.
 * Body: { key, title, minTierId?, isPreview?, categoryId?, folderId? }.
 */
export const runtime = 'nodejs'

const MAX_BYTES = 200 * 1024 * 1024

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'videos', 'create')) return apiError('Недостаточно прав', 403)
  if (!(await hasCapability(payload, tenantId, 'media'))) return apiError('Раздел медиа недоступен на текущем тарифе. Оформите пакет в студии.', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const key = String(data.key || '')
  // Ключ обязан лежать в неймспейсе этого тенанта — иначе можно привязать чужой объект.
  if (!key.startsWith(`audio/${tenantId}/`)) return apiError('Некорректный ключ файла')
  const head = await headObject(key)
  if (!head) return apiError('Файл не найден в хранилище — загрузка не завершилась')
  if (head.size > MAX_BYTES) return apiError('Файл больше 200 МБ')

  const title = String(data.title || '').trim() || 'Аудио'

  const categoryId = numOrNull(data.categoryId)
  if (categoryId != null && !(await belongsToTenant(payload, 'categories', categoryId, tenantId))) return apiError('Категория не найдена')
  const folderId = numOrNull(data.folderId)
  if (folderId != null && !(await belongsToTenant(payload, 'video-folders', folderId, tenantId))) return apiError('Папка не найдена')
  const minTierId = numOrNull(data.minTierId)
  if (minTierId != null && !(await belongsToTenant(payload, 'subscription-tiers', minTierId, tenantId))) return apiError('Уровень подписки не найден')

  try {
    const doc = (await payload.create({
      collection: 'videos',
      data: {
        title,
        slug: await uniqueSlug(payload, tenantId, slugify(title) || 'audio'),
        provider: 'audio',
        audioSrc: publicUrl(key),
        minTier: minTierId,
        isPreview: data.isPreview === true || data.isPreview === '1',
        category: categoryId,
        folder: folderId,
        publishedAt: new Date().toISOString(),
        tenant: tenantId,
        owner: author.user.id,
      } as any,
      overrideAccess: true,
    })) as any
    return apiOk({ id: doc.id, audioUrl: publicUrl(key) })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить аудио'), 500)
  }
})

/** Свободный slug в пределах тенанта: audio, audio-2, … */
async function uniqueSlug(payload: any, tenantId: number, base: string): Promise<string> {
  let candidate = base
  for (let n = 1; n < 100; n++) {
    const res = await payload.find({
      collection: 'videos',
      where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: candidate } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (res.totalDocs === 0) return candidate
    candidate = `${base}-${n + 1}`
  }
  return `${base}-${Date.now()}`
}
