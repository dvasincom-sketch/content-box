import { NextResponse } from 'next/server'
import { resolvePayContext } from '@/lib/payContext'
import { moderatorFor } from '../_mod'

/**
 * Модерация чата: скрыть/показать сообщение. Владелец студии или модератор
 * трансляции. Body: { id, hidden?=true }.
 */
export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  const pc = await resolvePayContext(req)
  if (!pc) return NextResponse.json({ error: 'Тенант не определён' }, { status: 400 })
  const { payload, tenantId } = pc

  let body: any = {}
  try { body = await req.json() } catch {}
  const id = body.id
  if (!id) return NextResponse.json({ error: 'Не указано сообщение' }, { status: 400 })
  const hidden = body.hidden !== false

  const m: any = await payload
    .findByID({ collection: 'stream-messages' as any, id, depth: 0, overrideAccess: true })
    .catch(() => null)
  const mt = m && (typeof m.tenant === 'object' ? m.tenant.id : m.tenant)
  if (!m || String(mt) !== String(tenantId)) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  const streamId = m.stream && (typeof m.stream === 'object' ? m.stream.id : m.stream)
  const stream: any = await payload
    .findByID({ collection: 'streams' as any, id: streamId, depth: 0, overrideAccess: true })
    .catch(() => null)
  const { canModerate } = await moderatorFor(tenantId, stream)
  if (!canModerate) return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })

  try {
    await payload.update({ collection: 'stream-messages' as any, id, data: { hidden } as any, overrideAccess: true })
    return NextResponse.json({ ok: true, id, hidden })
  } catch {
    return NextResponse.json({ error: 'Не удалось' }, { status: 500 })
  }
}
