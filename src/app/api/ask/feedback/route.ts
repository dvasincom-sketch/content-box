import { NextResponse, type NextRequest } from 'next/server'
import { tenantIdFromRequestHeaders } from '@/lib/tenantByHost'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { sqlRows } from '@/lib/sql'

/**
 * Оценка ответа Аси пользователем (👍/👎 в панели «Спросить Асю»). Проставляется
 * ТОЛЬКО самим спросившим подписчиком к своей записи диалога (id из ответа
 * /api/ask) — проверяем совпадение tenant + subscriber. Best-effort: сбой не
 * критичен для пользователя.
 *
 * POST { id, rating: 'up'|'down', comment? } → { ok }
 */
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body: any = await req.json().catch(() => null)
  const id = Number(body?.id)
  const rating = body?.rating === 'up' ? 'up' : body?.rating === 'down' ? 'down' : null
  const comment = String(body?.comment || '').slice(0, 500)
  if (!Number.isFinite(id) || !rating) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }

  const tenantId = await tenantIdFromRequestHeaders(req.headers)
  if (!tenantId) return NextResponse.json({ ok: false, error: 'unknown_domain' }, { status: 404 })

  const sub = await getCurrentSubscriber(tenantId)
  if (!sub) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  try {
    const payload = await getPayload({ config: await config })
    const rows = await sqlRows<{ id: number }>(
      payload,
      `UPDATE asya_questions
          SET rating = $1, rating_comment = NULLIF($2, ''), updated_at = now()
        WHERE id = $3 AND tenant_id = $4 AND subscriber_id = $5
        RETURNING id`,
      [rating, comment, id, tenantId, (sub as any).id],
    )
    if (!rows.length) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'feedback_failed' }, { status: 500 })
  }
}
