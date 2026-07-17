import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { slugify } from '@/lib/slugify'
import { streamCopyFromUrl } from '@/lib/cfStream'

/**
 * Создание видео из внешней ссылки (Яндекс Object Storage и т.п.).
 * Cloudflare Stream сам скачивает файл по URL — мы ничего не проксируем.
 *
 * Поток: валидируем → Stream /copy (requireSignedURLs=true) → получаем uid →
 * создаём запись Videos с videoRef=uid и статусом «кодируется» (readyToStream
 * приходит false; готовность проверяем отдельным роутом status).
 *
 * Body: { title, url, minTierId?, isPreview?, categoryId? }
 */
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let data: any
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  const title = String(data.title || '').trim()
  const url = String(data.url || '').trim()

  if (!title) return NextResponse.json({ error: 'Укажите название' }, { status: 400 })
  if (!isHttpUrl(url)) {
    return NextResponse.json(
      { error: 'Укажите прямую ссылку на видеофайл (http/https)' },
      { status: 400 },
    )
  }

  const payload = await getPayload({ config: await config })

  // 1) Запускаем копирование в Stream
  let uid: string
  try {
    const video = await streamCopyFromUrl({
      url,
      name: title,
      requireSignedURLs: true, // защищаем сразу — публично по uid не открыть
    })
    uid = video.uid
  } catch (e: any) {
    return NextResponse.json(
      { error: `Cloudflare Stream: ${e?.message || 'не удалось начать загрузку'}` },
      { status: 502 },
    )
  }

  // 2) Создаём запись Videos с uid в videoRef
  try {
    const doc = await payload.create({
      collection: 'videos',
      data: {
        title,
        slug: slugify(title) || uid,
        videoRef: uid,
        minTier: numOrNull(data.minTierId),
        isPreview: Boolean(data.isPreview),
        category: numOrNull(data.categoryId),
        tenant: author.tenantId,
      } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, id: doc.id, uid })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Видео ушло в Stream, но запись создать не удалось' },
      { status: 500 },
    )
  }
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
function numOrNull(v: any): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
