import { withAuthor, apiError, apiOk, belongsToTenant, hasCapability } from '@/app/(studio)/studio/api/_lib'
import { slugify } from '@/lib/slugify'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Загрузка одного аудиофайла (MP3 и др.). Файл идёт в S3 (коллекция media,
 * mimeTypes расширены на audio/*), создаётся запись Videos с provider='audio'
 * и audioSrc = публичный URL файла. Уровень доступа/категорию задаём тут же.
 *
 * multipart/form-data: file (обяз.), title, minTierId?, isPreview?, categoryId?, folderId?
 */
export const runtime = 'nodejs'

const MAX_BYTES = 200 * 1024 * 1024 // 200 МБ — многочасовые озвучки
const ALLOWED = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav']

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  if (!(await hasCapability(payload, tenantId, 'media'))) return apiError('Раздел медиа недоступен на текущем тарифе. Оформите пакет в студии.', 403)
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return apiError('Ожидается форма с файлом')
  }

  const file = form.get('file')
  if (!file || typeof file === 'string') return apiError('Файл не передан')
  const blob = file as File
  if (blob.type && !ALLOWED.includes(blob.type)) return apiError('Поддерживаются аудиофайлы (MP3 и другие)')
  if (blob.size > MAX_BYTES) return apiError('Файл больше 200 МБ')

  const title = String(form.get('title') || '').trim() || (blob as any).name || 'Аудио'

  const categoryId = numOrNull(form.get('categoryId'))
  if (categoryId != null && !(await belongsToTenant(payload, 'categories', categoryId, tenantId))) {
    return apiError('Категория не найдена')
  }
  const folderId = numOrNull(form.get('folderId'))
  if (folderId != null && !(await belongsToTenant(payload, 'video-folders', folderId, tenantId))) {
    return apiError('Папка не найдена')
  }
  const minTierId = numOrNull(form.get('minTierId'))
  if (minTierId != null && !(await belongsToTenant(payload, 'subscription-tiers', minTierId, tenantId))) {
    return apiError('Уровень подписки не найден')
  }

  try {
    const buffer = Buffer.from(await blob.arrayBuffer())
    const media = (await payload.create({
      collection: 'media',
      data: { tenant: tenantId, alt: title } as any,
      file: {
        data: buffer,
        name: (blob as any).name || `audio-${Date.now()}.mp3`,
        mimetype: blob.type || 'audio/mpeg',
        size: blob.size,
      },
      overrideAccess: true,
    })) as any
    const audioUrl = media?.url
    if (!audioUrl) return apiError('Файл загружен, но нет ссылки на него', 500)

    const doc = (await payload.create({
      collection: 'videos',
      data: {
        title,
        slug: await uniqueSlug(payload, tenantId, slugify(title) || 'audio'),
        provider: 'audio',
        audioSrc: audioUrl,
        minTier: minTierId,
        isPreview: form.get('isPreview') === 'true' || form.get('isPreview') === '1',
        category: categoryId,
        folder: folderId,
        publishedAt: new Date().toISOString(),
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })) as any

    return apiOk({ id: doc.id, audioUrl })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось загрузить аудио'), 500)
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
