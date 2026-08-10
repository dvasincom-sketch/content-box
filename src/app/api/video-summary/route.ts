import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { checkVideoAccess } from '@/lib/videoAccess'
import { tenantIdFromRequestHeaders } from '@/lib/tenantByHost'
import { getObjectText } from '@/lib/s3'
import { asyaEnabled, summarizeTranscript, vttToPlainText } from '@/lib/asya'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Краткое содержание видео от Аси. Транскрипт берём из субтитров (VTT в S3),
 * Асю дёргаем сервер-к-серверу. Результат кэшируем на videos.summary — повторный
 * запрос отдаётся мгновенно без обращения к API. Доступ гейтится как у видео.
 *
 * Body: { videoId, refresh? } → { ok, cached, summary:{tldr,points,text,hash,lang,at} }
 */
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body: any = await req.json().catch(() => null)
  const videoId = body?.videoId
  const refresh = body?.refresh === true
  if (!videoId) return NextResponse.json({ ok: false, error: 'no_video' }, { status: 400 })

  const tenantId = await tenantIdFromRequestHeaders(req.headers)
  if (!tenantId) return NextResponse.json({ ok: false, error: 'unknown_domain' }, { status: 404 })

  const access = await checkVideoAccess({ id: String(videoId), tenantId })
  if (!access.allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  const video: any = access.video

  // Кэш на видео — мгновенно, без обращения к Асе.
  if (!refresh && video.summary && (video.summary.tldr || video.summary.text)) {
    return NextResponse.json({ ok: true, cached: true, summary: video.summary })
  }

  if (!asyaEnabled()) return NextResponse.json({ ok: false, error: 'summary_disabled' }, { status: 503 })

  // Транскрипт из субтитров (предпочитаем ru/авто, иначе первый доступный).
  const subs: any[] = Array.isArray(video.subtitles) ? video.subtitles : []
  const track = subs.find((s) => s?.key && String(s.lang) === 'ru') || subs.find((s) => s?.key)
  if (!track) return NextResponse.json({ ok: false, error: 'no_transcript' }, { status: 400 })

  try {
    const vtt = await getObjectText(String(track.key))
    if (!vtt) return NextResponse.json({ ok: false, error: 'no_transcript' }, { status: 400 })
    const transcript = vttToPlainText(vtt)
    if (transcript.length < 30) return NextResponse.json({ ok: false, error: 'transcript_too_short' }, { status: 400 })

    const r = await summarizeTranscript({
      transcript,
      title: String(video.title || ''),
      source: `video:${videoId}`,
      lang: String(track.lang || 'ru'),
      refresh,
    })
    const summary = { tldr: r.tldr, points: r.points, text: r.text, hash: r.hash, lang: r.lang, at: new Date().toISOString() }

    const payload = await getPayload({ config: await config })
    await payload.update({ collection: 'videos', id: video.id, data: { summary } as any, overrideAccess: true, depth: 0 })

    return NextResponse.json({ ok: true, cached: false, summary })
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(e, 'summary_failed') }, { status: 500 })
  }
}
