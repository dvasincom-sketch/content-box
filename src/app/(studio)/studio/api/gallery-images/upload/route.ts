import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Загрузка одного изображения в коллекцию gallery-images. Файл идёт в R2
 * (s3Storage). Клиент шлёт файлы очередью (по одному запросу на файл,
 * параллельность 3-4) — здесь принимаем ровно один файл.
 *
 * Принимает multipart/form-data:
 *   file      — сам файл (обязателен)
 *   folderId  — id папки библиотеки (опционально)
 *   alt       — подпись/alt (опционально)
 *
 * Возвращает { id, url, width, height } — размеры нужны фронту для justified-grid.
 */

export const runtime = 'nodejs'

const MAX_BYTES = 25 * 1024 * 1024 // 25 MB — фото галереи крупнее обложек
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

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
    return NextResponse.json(
      { error: 'Поддерживаются изображения: JPEG, PNG, WebP, GIF, AVIF' },
      { status: 400 },
    )
  }
  if (blob.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Файл больше 25 МБ' }, { status: 400 })
  }

  const payload = await getPayload({ config: await config })
  const tenantId = author.tenantId

  // Папка (если задана) — проверяем принадлежность тенанту
  let folderId: number | null = null
  const rawFolder = form.get('folderId')
  if (rawFolder && typeof rawFolder === 'string' && rawFolder !== '') {
    const ok = await belongsToTenant(payload, 'gallery-folders', rawFolder, tenantId)
    if (ok) folderId = Number(rawFolder)
  }

  const alt = (form.get('alt') as string) || (blob as any).name || ''

  try {
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const doc = await payload.create({
      collection: 'gallery-images',
      data: {
        tenant: tenantId,
        alt: alt || undefined,
        ...(folderId ? { folder: folderId } : {}),
      } as any,
      file: {
        data: buffer,
        name: (blob as any).name || `img-${Date.now()}`,
        mimetype: blob.type,
        size: blob.size,
      },
      overrideAccess: true,
    })

    const d = doc as any
    return NextResponse.json({
      ok: true,
      id: d.id,
      url: d.url || null,
      width: d.width || null,
      height: d.height || null,
      alt: d.alt || '',
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось загрузить изображение' },
      { status: 500 },
    )
  }
}

async function belongsToTenant(
  payload: any,
  collection: string,
  id: string | number,
  tenantId: number,
): Promise<boolean> {
  try {
    const doc = await payload.findByID({ collection, id, depth: 0, overrideAccess: true })
    const t = doc?.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc?.tenant
    return Number(t) === Number(tenantId)
  } catch {
    return false
  }
}
