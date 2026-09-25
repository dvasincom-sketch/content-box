import { NextResponse } from 'next/server'
import { resolvePayContext } from '@/lib/payContext'
import { moderatorFor } from '../_mod'

/**
 * Забанить/разбанить подписчика в чате трансляций (владелец или модератор
 * трансляции). Ставит subscribers.chatBanned. При бане (если передан stream)
 * прячет его сообщения в этой трансляции. Доступ к контенту НЕ трогаем — только
 * чат. Body: { subscriber, banned?=true, stream? }.
 */
export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  const pc = await resolvePayContext(req)
  if (!pc) return NextResponse.json({ error: 'Тенант не определён' }, { status: 400 })
  const { payload, tenantId } = pc

  let body: any = {}
  try { body = await req.json() } catch {}
  const subId = body.subscriber
  if (subId == null || subId === '') return NextResponse.json({ error: 'Не указан пользователь' }, { status: 400 })
  const banned = body.banned !== false

  // Авторизация: владелец студии, либо модератор указанной трансляции.
  const stream: any =
    body.stream != null && body.stream !== ''
      ? await payload.findByID({ collection: 'streams' as any, id: body.stream, depth: 0, overrideAccess: true }).catch(() => null)
      : null
  const { canModerate } = await moderatorFor(tenantId, stream)
  if (!canModerate) return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })

  const sub: any = await payload
    .findByID({ collection: 'subscribers', id: subId, depth: 0, overrideAccess: true })
    .catch(() => null)
  const st = sub && (typeof sub.tenant === 'object' ? sub.tenant.id : sub.tenant)
  if (!sub || String(st) !== String(tenantId)) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })

  try {
    await payload.update({ collection: 'subscribers', id: subId, data: { chatBanned: banned } as any, overrideAccess: true })
    // При бане прячем его сообщения в этой трансляции (если указана).
    if (banned && body.stream != null && body.stream !== '') {
      await payload
        .update({
          collection: 'stream-messages' as any,
          where: { and: [{ tenant: { equals: tenantId } }, { stream: { equals: body.stream } }, { subscriber: { equals: subId } }] },
          data: { hidden: true } as any,
          overrideAccess: true,
        })
        .catch(() => {})
    }
    return NextResponse.json({ ok: true, subscriber: subId, banned })
  } catch {
    return NextResponse.json({ error: 'Не удалось' }, { status: 500 })
  }
}
