import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { streamCreateTusUpload, buildUploadMetadata } from '@/lib/cfStream'

/**
 * Выдаёт браузеру одноразовый TUS upload-URL для прямой загрузки видео в
 * Cloudflare Stream (минуя наш сервер). API-токен остаётся на сервере.
 *
 * Body: { size: number (байты), name?: string }
 * Ответ: { uploadURL, uid }
 *
 * Видео сразу помечается requireSignedURLs — защищённое, доступ по подписке.
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

  const size = Number(data.size)
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: 'Не указан размер файла' }, { status: 400 })
  }
  // здравый лимит — 20 ГБ, чтобы отсечь мусор
  if (size > 20 * 1024 * 1024 * 1024) {
    return NextResponse.json({ error: 'Файл слишком большой (>20 ГБ)' }, { status: 400 })
  }

  const name = String(data.name || 'video').slice(0, 200)

  try {
    const metadata = buildUploadMetadata({ name, requireSignedURLs: true })
    const { uploadURL, uid } = await streamCreateTusUpload({
      uploadLength: size,
      uploadMetadata: metadata,
    })
    return NextResponse.json({ ok: true, uploadURL, uid })
  } catch (e: any) {
    return NextResponse.json(
      { error: `Cloudflare Stream: ${e?.message || 'не удалось начать загрузку'}` },
      { status: 502 },
    )
  }
}
