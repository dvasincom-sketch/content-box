import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

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

export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Ожидается форма с файлом' }, { status: 400 })
  }

  const file = form.get('file')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
  }

  const blob = file as File
  if (!ALLOWED.includes(blob.type)) {
    return NextResponse.json({ error: 'Поддерживаются JPEG, PNG, WebP, AVIF, GIF' }, { status: 400 })
  }
  if (blob.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Файл больше 8 МБ' }, { status: 400 })
  }

  const payload = await getPayload({ config: await config })

  try {
    const buffer = Buffer.from(await blob.arrayBuffer())
    const media = await payload.create({
      collection: 'media',
      data: { tenant: author.tenantId } as any,
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
      if (cat && Number(catTenant) === Number(author.tenantId)) {
        await payload.update({
          collection: 'categories',
          id: categoryId,
          data: { cover: media.id } as any,
          overrideAccess: true,
        })
      }
    }

    return NextResponse.json({ ok: true, id: media.id, url: (media as any).url || null })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Не удалось загрузить' }, { status: 500 })
  }
}
