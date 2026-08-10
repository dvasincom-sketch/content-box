import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { tenantIdFromRequestHeaders } from '@/lib/tenantByHost'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { getObjectText } from '@/lib/s3'
import { asyaEnabled, summarizeTranscript, vttToPlainText, ASYA_MIN_TIER_PRICE } from '@/lib/asya'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Краткое содержание видео от Аси. Премиум-фича: доступна ТОЛЬКО подписчикам на
 * тарифе с ценой >= ASYA_MIN_TIER_PRICE (по умолчанию 2000₽; «Золотой» и дороже).
 * Остальным возвращаем `upsell` — кнопка на витрине показывается всем как апселл.
 * Транскрипт берём из субтитров (VTT в S3), Асю дёргаем сервер-к-серверу,
 * результат кэшируем на videos.summary (повтор — мгновенно, без обращения к API).
 *
 * Body: { videoId, refresh? }
 */
export const runtime = 'nodejs'

async function isEligible(payload: any, sub: any): Promise<boolean> {
  if (!sub || sub.isBlocked) return false
  if (!sub.subscriptionUntil || new Date(sub.subscriptionUntil) <= new Date()) return false
  const rel = sub.activeTier
  if (!rel) return false
  const tid = typeof rel === 'object' ? rel.id : rel
  const tier: any = await payload.findByID({ collection: 'subscription-tiers', id: tid, depth: 0, overrideAccess: true }).catch(() => null)
  return !!tier && Number(tier.priceRub) >= ASYA_MIN_TIER_PRICE
}

export async function POST(req: NextRequest) {
  const body: any = await req.json().catch(() => null)
  const videoId = body?.videoId
  const refresh = body?.refresh === true
  if (!videoId) return NextResponse.json({ ok: false, error: 'no_video' }, { status: 400 })

  const tenantId = await tenantIdFromRequestHeaders(req.headers)
  if (!tenantId) return NextResponse.json({ ok: false, error: 'unknown_domain' }, { status: 404 })

  const payload = await getPayload({ config: await config })
  const video: any = await payload.findByID({ collection: 'videos', id: String(videoId), depth: 0, overrideAccess: true }).catch(() => null)
  const vt = video && (typeof video.tenant === 'object' ? video.tenant?.id : video.tenant)
  if (!video || Number(vt) !== Number(tenantId) || video.provider !== 'self') {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  // Гейт по тарифу (премиум). Не прошёл → апселл.
  const sub = await getCurrentSubscriber(tenantId)
  if (!(await isEligible(payload, sub))) {
    return NextResponse.json({ ok: false, error: 'upsell', minPrice: ASYA_MIN_TIER_PRICE }, { status: 402 })
  }

  // Кэш на видео — мгновенно.
  if (!refresh && video.summary && (video.summary.tldr || video.summary.text)) {
    return NextResponse.json({ ok: true, cached: true, summary: video.summary })
  }
  if (!asyaEnabled()) return NextResponse.json({ ok: false, error: 'summary_disabled' }, { status: 503 })

  const subs: any[] = Array.isArray(video.subtitles) ? video.subtitles : []
  const track = subs.find((s) => s?.key && String(s.lang) === 'ru') || subs.find((s) => s?.key)
  if (!track) return NextResponse.json({ ok: false, error: 'no_transcript' }, { status: 400 })

  try {
    const vtt = await getObjectText(String(track.key))
    if (!vtt) return NextResponse.json({ ok: false, error: 'no_transcript' }, { status: 400 })
    const transcript = vttToPlainText(vtt)
    if (transcript.length < 30) return NextResponse.json({ ok: false, error: 'transcript_too_short' }, { status: 400 })

    const r = await summarizeTranscript({ transcript, title: String(video.title || ''), source: `video:${videoId}`, lang: String(track.lang || 'ru'), refresh })
    const summary = { tldr: r.tldr, points: r.points, text: r.text, hash: r.hash, lang: r.lang, at: new Date().toISOString() }
    await payload.update({ collection: 'videos', id: video.id, data: { summary } as any, overrideAccess: true, depth: 0 })
    return NextResponse.json({ ok: true, cached: false, summary })
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(e, 'summary_failed') }, { status: 500 })
  }
}
