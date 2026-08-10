import { NextResponse, type NextRequest } from 'next/server'
import { s3, S3_BUCKET, presignGet } from '@/lib/s3'
import { verifyPlaybackToken } from '@/lib/videoJwt'
import { GetObjectCommand } from '@aws-sdk/client-s3'

/**
 * Подписанная отдача сториборда (scrub-preview) собственного видео. Тот же JWT,
 * что и у /api/hls (из /api/video-token). Файлы лежат под sprites/{pid}/:
 *  - storyboard.vtt — таблица кадров (cue → storyboard.jpg#xywh). Отдаём с
 *    переписанными на абсолютные токанизированные URL ссылками на картинку,
 *    чтобы клиент мог грузить и парсить без дополнительной сборки путей.
 *  - storyboard.jpg — спрайт-лист: 302 на короткоживущий presigned S3 GET.
 */
export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ playbackId: string; file: string[] }> },
) {
  const { playbackId, file } = await params
  const token = req.nextUrl.searchParams.get('t')
  const pid = verifyPlaybackToken(token)
  if (!pid || pid !== playbackId) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 401 })
  }

  const parts = (Array.isArray(file) ? file : [file]).filter(Boolean)
  if (!parts.length || parts.some((p) => p.includes('..') || p.includes('\\'))) {
    return NextResponse.json({ error: 'Некорректный путь' }, { status: 400 })
  }

  const key = `sprites/${playbackId}/${parts.join('/')}`
  const isVtt = parts[parts.length - 1].endsWith('.vtt')

  if (isVtt) {
    try {
      const obj = await s3().send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }))
      const text = await (obj.Body as unknown as { transformToString: () => Promise<string> }).transformToString()
      const dir = parts.slice(0, -1)
      const t = encodeURIComponent(token as string)
      // Переписываем строки-payload вида `storyboard.jpg#xywh=...` на абсолютный
      // токанизированный URL; фрагмент #xywh идёт ПОСЛЕ ?t=..., как требует URL.
      const rewritten = text
        .split('\n')
        .map((line) => {
          const hashIdx = line.indexOf('#xywh=')
          if (hashIdx <= 0) return line
          const img = line.slice(0, hashIdx).trim()
          const frag = line.slice(hashIdx)
          if (!img || img.startsWith('#')) return line
          const resolved = [...dir, img].join('/')
          return `/api/video-sprite/${playbackId}/${resolved}?t=${t}${frag}`
        })
        .join('\n')
      return new NextResponse(rewritten, {
        status: 200,
        headers: { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'private, max-age=300' },
      })
    } catch {
      return NextResponse.json({ error: 'Сториборд не найден' }, { status: 404 })
    }
  }

  // Картинка спрайт-листа — редирект на presigned S3 GET.
  try {
    const url = await presignGet(key, 2 * 60 * 60)
    return NextResponse.redirect(url, 302)
  } catch {
    return NextResponse.json({ error: 'Кадры не найдены' }, { status: 404 })
  }
}
