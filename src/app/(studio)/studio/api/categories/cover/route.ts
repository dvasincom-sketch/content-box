import { withAuthor, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Загрузка обложки категории в media (R2). Возвращает { id, url } — привязка к
 * категории делается отдельным вызовом update (coverId), либо сразу если передан
 * categoryId. Тенант из сессии автора.
 *
 * multipart/form-data: file (обязательно), categoryId (опц. — сразу привязать).
 */
export const runtime = 'nodejs'

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return apiError('Ожидается форма с файлом')
  }

  const file = form.get('file')
  if (!file || typeof file === 'string') {
    return apiError('Файл не передан')
  }

  const blob = file as File
  if (!ALLOWED.includes(blob.type)) {
    return apiError('Поддерживаются JPEG, PNG, WebP, AVIF, GIF')
  }
  if (blob.size > MAX_BYTES) {
    return apiError('Файл больше 8 МБ')
  }

  try {
    const buffer = Buffer.from(await blob.arrayBuffer())
    const media = await payload.create({
      collection: 'media',
      data: { tenant: tenantId } as any,
      file: {
        data: buffer,
        name: (blob as any).name || `cat-cover-${Date.now()}`,
        mimetype: blob.type,
        size: blob.size,
      },
      overrideAccess: true,
    })

    // Опционально сразу привязать к категории (если она уже существует и наша)
    const categoryId = form.get('categoryId')
    if (categoryId && typeof categoryId === 'string') {
      const cat: any = await payload
        .findByID({ collection: 'categories', id: categoryId, depth: 0, overrideAccess: true })
        .catch(() => null)
      const catTenant = cat?.tenant && typeof cat.tenant === 'object' ? cat.tenant.id : cat?.tenant
      if (cat && Number(catTenant) === Number(tenantId)) {
        await payload.update({
          collection: 'categories',
          id: categoryId,
          data: { cover: media.id } as any,
          overrideAccess: true,
        })
      }
    }

    return apiOk({ id: media.id, url: (media as any).url || null })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось загрузить', 500)
  }
})
