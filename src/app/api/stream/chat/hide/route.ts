import { NextResponse } from 'next/server'
import { resolvePayContext } from '@/lib/payContext'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Модерация чата: скрыть/показать сообщение. Только владелец студии этого
 * тенанта. Body: { id, hidden?=true }.
 */
export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  const pc = await resolvePayContext(req)
  if (!pc) return NextResponse.json({ error: 'Тенант не определён' }, { status: 400 })
  const { payload, tenantId } = pc

  const author = await getCurrentAuthor().catch(() => null)
  const owner =
    author &&
    Number(author.tenantId) === Number(tenantId) &&
    (author.user as { tenantRole?: string | null })?.tenantRole !== 'contributor'
  if (!owner) return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })

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

  try {
    await payload.update({ collection: 'stream-messages' as any, id, data: { hidden } as any, overrideAccess: true })
    return NextResponse.json({ ok: true, id, hidden })
  } catch {
    return NextResponse.json({ error: 'Не удалось' }, { status: 500 })
  }
}
