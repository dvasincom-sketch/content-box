import { NextResponse, type NextRequest } from 'next/server'
import { s3, S3_BUCKET } from '@/lib/s3'
import { verifyPlaybackToken } from '@/lib/videoJwt'
import { GetObjectCommand } from '@aws-sdk/client-s3'

/**
 * Подписанная отдача дорожки субтитров (VTT) своего видео. Тот же playback-JWT,
 * что и у /api/hls. Файл крошечный — проксируем текст через приложение (не 302),
 * чтобы <track> не упирался в CORS на presigned S3. Ключ: subs/{pid}/{lang}.vtt.
 */
export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ playbackId: string; lang: string }> },
) {
  const { playbackId, lang } = await params
  const token = req.nextUrl.searchParams.get('t')
  const pid = verifyPlaybackToken(token)
  if (!pid || pid !== playbackId) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 401 })
  }
  // Язык — только безопасный код (без обхода каталога).
  if (!/^[a-z]{2,3}(-[a-z]{2,4})?$/.test(lang)) {
    return NextResponse.json({ error: 'Некорректный язык' }, { status: 400 })
  }

  const key = `subs/${playbackId}/${lang}.vtt`
  try {
    const obj = await s3().send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }))
    const text = await (obj.Body as unknown as { transformToString: () => Promise<string> }).transformToString()
    return new NextResponse(text, {
      status: 200,
      headers: { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'private, max-age=300' },
    })
  } catch {
    return NextResponse.json({ error: 'Субтитры не найдены' }, { status: 404 })
  }
}
