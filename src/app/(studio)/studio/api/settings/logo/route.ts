import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Загрузка логотипа: файл → media (R2), затем site-settings.logo = media.id.
 * multipart/form-data, поле `file`. Возвращает { id, url }.
 */

export const runtime = 'nodejs'

const MAX_BYTES = 6 * 1024 * 1024 // 6 MB — логотипу больше не нужно
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/avif']

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
      { error: 'Поддерживаются: JPEG, PNG, WebP, SVG, AVIF' },
      { status: 400 },
    )
  }
  if (blob.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Файл больше 6 МБ' }, { status: 400 })
  }

  const payload = await getPayload({ config: await config })

  try {
    const buffer = Buffer.from(await blob.arrayBuffer())
    const media = await payload.create({
      collection: 'media',
      data: { tenant: author.tenantId } as any,
      file: {
        data: buffer,
        name: (blob as any).name || `logo-${Date.now()}`,
        mimetype: blob.type,
        size: blob.size,
      },
      overrideAccess: true,
    })

    // привязать к настройкам
    const settings = await findSettings(payload, author.tenantId)
    if (settings) {
      await payload.update({
        collection: 'site-settings',
        id: settings.id,
        data: { logo: media.id } as any,
        overrideAccess: true,
      })
    }

    return NextResponse.json({ ok: true, id: media.id, url: (media as any).url || null })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось загрузить логотип' },
      { status: 500 },
    )
  }
}

async function findSettings(payload: any, tenantId: number) {
  const res = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs[0] || null
}
