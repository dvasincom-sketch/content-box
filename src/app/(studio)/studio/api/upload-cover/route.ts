import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Загрузка обложки в коллекцию media. Файл идёт в R2 (s3Storage настроен в
 * payload.config). Тенант проставляется из сессии автора.
 *
 * Принимает multipart/form-data с полем `file`. Возвращает { id, url }.
 */

export const runtime = 'nodejs'

// разумный лимит на обложку
const MAX_BYTES = 12 * 1024 * 1024 // 12 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

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
    return NextResponse.json(
      { error: 'Поддерживаются изображения: JPEG, PNG, WebP, GIF, AVIF' },
      { status: 400 },
    )
  }
  if (blob.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Файл больше 12 МБ' }, { status: 400 })
  }

  const payload = await getPayload({ config: await config })

  try {
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const doc = await payload.create({
      collection: 'media',
      data: { tenant: author.tenantId } as any,
      file: {
        data: buffer,
        name: (blob as any).name || `cover-${Date.now()}`,
        mimetype: blob.type,
        size: blob.size,
      },
      overrideAccess: true,
    })

    const url = (doc as any)?.url || null
    return NextResponse.json({ ok: true, id: doc.id, url })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось загрузить файл' },
      { status: 500 },
    )
  }
}
