import { NextResponse, type NextRequest } from 'next/server'
import { s3, S3_BUCKET, presignGet } from '@/lib/s3'
import { verifyPlaybackToken } from '@/lib/videoJwt'
import { GetObjectCommand } from '@aws-sdk/client-s3'

/**
 * Подписанная отдача HLS собственного видео.
 *
 * Плеер получает master-URL с ?t=<JWT> из /api/video-token (там уже проверен
 * доступ по подписке). Здесь:
 *  - .m3u8 — забираем из S3, ПЕРЕПИСЫВАЕМ дочерние URI на абсолютные
 *    /api/hls/<pid>/<путь>?t=<тот же токен> и отдаём как плейлист. Так токен
 *    сам «протекает» в запросы вариантов и сегментов — кастомный loader в
 *    hls.js не нужен, а относительные пути резолвятся корректно.
 *  - сегменты (.ts и прочее) — 302 на presigned S3 GET: тяжёлые байты идут
 *    S3 → клиент напрямую, мимо приложения.
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
  // Защита от обхода каталога.
  if (!parts.length || parts.some((p) => p.includes('..') || p.includes('\\'))) {
    return NextResponse.json({ error: 'Некорректный путь' }, { status: 400 })
  }

  const key = `hls/${playbackId}/${parts.join('/')}`
  const isPlaylist = parts[parts.length - 1].endsWith('.m3u8')

  if (isPlaylist) {
    try {
      const obj = await s3().send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }))
      const text = await (obj.Body as unknown as { transformToString: () => Promise<string> }).transformToString()
      const dir = parts.slice(0, -1)
      const t = encodeURIComponent(token as string)
      const rewritten = text
        .split('\n')
        .map((line) => {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) return line
          // строка-URI (вариант или сегмент) — резолвим относительно каталога.
          const resolved = [...dir, trimmed].join('/')
          return `/api/hls/${playbackId}/${resolved}?t=${t}`
        })
        .join('\n')
      return new NextResponse(rewritten, {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store' },
      })
    } catch {
      return NextResponse.json({ error: 'Плейлист не найден' }, { status: 404 })
    }
  }

  // Сегмент/иной файл — редирект на короткоживущий presigned S3 GET.
  try {
    const url = await presignGet(key, 120)
    return NextResponse.redirect(url, 302)
  } catch {
    return NextResponse.json({ error: 'Сегмент не найден' }, { status: 404 })
  }
}
