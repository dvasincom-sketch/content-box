import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { tenantIdFromRequestHeaders } from '@/lib/tenantByHost'

/**
 * Оценка саммари Аси зрителем (полезно / не очень). Лёгкий сигнал качества —
 * инкрементим счётчики в videos.summary.feedback {up,down}. Дедуп на клиенте
 * (localStorage); сервер не критичен — на любой ошибке тихо отвечаем ok.
 * Body: { videoId, vote: 'up' | 'down' }
 */
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body: any = await req.json().catch(() => null)
  const videoId = body?.videoId
  const vote = body?.vote === 'down' ? 'down' : body?.vote === 'up' ? 'up' : null
  if (!videoId || !vote) return NextResponse.json({ ok: false }, { status: 400 })

  const tenantId = await tenantIdFromRequestHeaders(req.headers)
  if (!tenantId) return NextResponse.json({ ok: false }, { status: 204 })

  try {
    const payload = await getPayload({ config: await config })
    const video: any = await payload.findByID({ collection: 'videos', id: String(videoId), depth: 0, overrideAccess: true }).catch(() => null)
    const vt = video && (typeof video.tenant === 'object' ? video.tenant?.id : video.tenant)
    if (!video || Number(vt) !== Number(tenantId) || !video.summary) return NextResponse.json({ ok: true })

    const fb = (video.summary.feedback && typeof video.summary.feedback === 'object') ? video.summary.feedback : { up: 0, down: 0 }
    const next = { up: Number(fb.up) || 0, down: Number(fb.down) || 0 }
    next[vote] += 1
    await payload.update({
      collection: 'videos',
      id: video.id,
      data: { summary: { ...video.summary, feedback: next } } as any,
      overrideAccess: true,
      depth: 0,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
