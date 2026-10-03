import { NextResponse, type NextRequest } from 'next/server'
import { tenantIdFromRequestHeaders } from '@/lib/tenantByHost'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { asyaEnabled, askAsya } from '@/lib/asya'
import { errorMessage } from '@/lib/errorMessage'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { logAiUsage, estimateTokens } from '@/lib/logAiUsage'

/**
 * Панель «Спросить Асю» на сайте. Ассистент по видео — перк подписки: доступен
 * ТОЛЬКО активному платному подписчику (в рамках его подписки). Остальным —
 * состояние апселла (панель показывается всем как крючок).
 *
 * Ключ Аси — секрет, дёргаем её строго сервер-к-серверу (никогда из браузера).
 *  GET  → { ok, available, eligible }  — доступность фичи и право текущего зрителя
 *  POST { q } → { ok, answer, matches } | 402 upsell
 */
export const runtime = 'nodejs'

function isPaidActive(sub: any): boolean {
  if (!sub || sub.isBlocked) return false
  if (!sub.subscriptionUntil || new Date(sub.subscriptionUntil) <= new Date()) return false
  return !!sub.activeTier
}

export async function GET(req: NextRequest) {
  const tenantId = await tenantIdFromRequestHeaders(req.headers)
  const sub = tenantId ? await getCurrentSubscriber(tenantId) : null
  return NextResponse.json({ ok: true, available: asyaEnabled(), eligible: isPaidActive(sub) })
}

export async function POST(req: NextRequest) {
  const body: any = await req.json().catch(() => null)
  const q = String(body?.q || '').trim()
  if (q.length < 2) return NextResponse.json({ ok: false, error: 'no_query' }, { status: 400 })

  const tenantId = await tenantIdFromRequestHeaders(req.headers)
  if (!tenantId) return NextResponse.json({ ok: false, error: 'unknown_domain' }, { status: 404 })

  const sub = await getCurrentSubscriber(tenantId)
  if (!isPaidActive(sub)) return NextResponse.json({ ok: false, error: 'upsell' }, { status: 402 })
  if (!asyaEnabled()) return NextResponse.json({ ok: false, error: 'disabled' }, { status: 503 })

  try {
    const r = await askAsya(q)
    // Сохраняем диалог (вопрос/ответ/видео) для обратной связи и возвращаем id,
    // чтобы виджет мог прислать оценку 👍/👎. Учёт токенов — как раньше.
    let logId: number | null = null
    try {
      const payload = await getPayload({ config: await config })
      const hadMatches = Array.isArray(r.matches) && r.matches.some((m) => !!m.url)
      try {
        const doc = await payload.create({
          collection: 'asya-questions',
          data: {
            tenant: tenantId,
            question: q.slice(0, 2000),
            answer: String(r.answer || '').slice(0, 8000),
            matches: r.matches,
            hadMatches,
            context: String(body?.page || '').slice(0, 300) || undefined,
            subscriber: (sub as any)?.id ?? undefined,
          },
          overrideAccess: true,
        } as any)
        logId = Number((doc as any)?.id) || null
      } catch { /* журнал диалога вторичен */ }
      void logAiUsage(payload, {
        tenant: tenantId,
        surface: 'support',
        action: 'ask',
        tokensIn: estimateTokens(q),
        tokensOut: estimateTokens(r.answer),
        actorType: 'subscriber',
      })
    } catch { /* учёт вторичен */ }
    return NextResponse.json({ ok: true, id: logId, answer: r.answer, matches: r.matches })
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(e, 'ask_failed') }, { status: 500 })
  }
}
