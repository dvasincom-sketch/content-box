import { NextResponse } from 'next/server'
import { resolvePayContext } from '@/lib/payContext'
import { checkPublicationAccess } from '@/lib/publicationAccess'
import { moderatorFor } from './_mod'

/**
 * Чат трансляции (поллинг). Тенант — по хосту (на /api нет x-tenant-id).
 *
 * GET  ?stream=<id>&after=<lastId> → { messages, canPost, canModerate }.
 *   Читать может подписчик с доступом ИЛИ владелец студии (для модерации).
 * POST { stream, text } → отправить (подписчик с доступом, не заблокирован,
 *   рейт-лимит 1.5с). Возвращает созданное сообщение.
 */
export const runtime = 'nodejs'

async function loadStream(payload: any, tenantId: string, streamId: unknown) {
  if (streamId == null || streamId === '') return null
  const s: any = await payload
    .findByID({ collection: 'streams' as any, id: streamId, depth: 1, overrideAccess: true })
    .catch(() => null)
  const st = s && (typeof s.tenant === 'object' ? s.tenant.id : s.tenant)
  return s && String(st) === String(tenantId) ? s : null
}

export async function GET(req: Request): Promise<Response> {
  const pc = await resolvePayContext(req)
  if (!pc) return NextResponse.json({ error: 'Тенант не определён' }, { status: 400 })
  const { payload, tenantId } = pc

  const url = new URL(req.url)
  const streamId = url.searchParams.get('stream')
  const after = Number(url.searchParams.get('after') || '0') || 0
  const stream = await loadStream(payload, tenantId, streamId)
  if (!stream) return NextResponse.json({ error: 'Трансляция не найдена' }, { status: 404 })
  if (stream.chatEnabled === false) {
    return NextResponse.json({ messages: [], canPost: false, canModerate: false, disabled: true })
  }

  const access = await checkPublicationAccess(stream)
  const mod = await moderatorFor(tenantId, stream)
  const canMod = mod.canModerate
  if (!access.allowed && !canMod) {
    return NextResponse.json({ messages: [], canPost: false, canModerate: false, needAccess: true })
  }

  const and: any[] = [{ tenant: { equals: tenantId } }, { stream: { equals: stream.id } }]
  if (after > 0) and.push({ id: { greater_than: after } })
  if (!canMod) and.push({ hidden: { not_equals: true } })

  const res = await payload.find({
    collection: 'stream-messages' as any,
    where: { and },
    sort: 'createdAt',
    limit: 300,
    depth: 0,
    overrideAccess: true,
  })
  const mySubId = access.allowed && (access as any).subscriber ? String((access as any).subscriber.id) : null
  const messages = (res.docs as any[]).map((m) => ({
    id: m.id,
    name: m.name || 'Зритель',
    text: m.text,
    at: m.createdAt,
    hidden: !!m.hidden,
    pinned: !!m.pinned,
    mine: mySubId ? String(m.subscriber) === mySubId : false,
    ...(canMod ? { sub: m.subscriber ? Number(m.subscriber) : null } : {}),
  }))

  // Закреплённое сообщение — всегда, независимо от `after` (оно может быть старым).
  const pinRes = await payload.find({
    collection: 'stream-messages' as any,
    where: { and: [{ tenant: { equals: tenantId } }, { stream: { equals: stream.id } }, { pinned: { equals: true } }] },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const pm: any = (pinRes.docs as any[])[0] || null
  const pinned = pm ? { id: pm.id, name: pm.name || 'Зритель', text: pm.text } : null

  // Для модератора — кто из авторов видимых сообщений забанен в чате.
  let bannedSubscriberIds: number[] = []
  if (canMod) {
    const subIds = Array.from(
      new Set((res.docs as any[]).map((m) => (m.subscriber ? Number(m.subscriber) : null)).filter((x): x is number => x != null)),
    )
    if (subIds.length) {
      const b = await payload
        .find({
          collection: 'subscribers',
          where: { and: [{ tenant: { equals: tenantId } }, { id: { in: subIds } }, { chatBanned: { equals: true } }] },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        })
        .catch(() => ({ docs: [] as any[] }))
      bannedSubscriberIds = (b.docs as any[]).map((s) => Number(s.id))
    }
  }

  const sub = (access as any).subscriber
  const canPost = access.allowed && !sub?.isBlocked && !sub?.chatBanned
  return NextResponse.json({ messages, pinned, canPost, canModerate: canMod, bannedSubscriberIds })
}

export async function POST(req: Request): Promise<Response> {
  const pc = await resolvePayContext(req)
  if (!pc) return NextResponse.json({ error: 'Тенант не определён' }, { status: 400 })
  const { payload, tenantId } = pc

  let body: any = {}
  try { body = await req.json() } catch {}
  const text = String(body.text || '').trim().slice(0, 500)
  const stream = await loadStream(payload, tenantId, body.stream)
  if (!stream) return NextResponse.json({ error: 'Трансляция не найдена' }, { status: 404 })
  if (stream.chatEnabled === false) return NextResponse.json({ error: 'Чат отключён' }, { status: 403 })
  if (!text) return NextResponse.json({ error: 'Пустое сообщение' }, { status: 400 })

  const access = await checkPublicationAccess(stream)
  if (!access.allowed) {
    const needLogin = access.reason === 'need-login'
    return NextResponse.json(
      { error: needLogin ? 'Войдите, чтобы писать в чат' : 'Чат доступен по подписке', needAccess: true },
      { status: needLogin ? 401 : 403 },
    )
  }
  const sub = (access as any).subscriber
  if (!sub) return NextResponse.json({ error: 'Войдите, чтобы писать в чат', needAccess: true }, { status: 401 })
  if (sub.isBlocked) return NextResponse.json({ error: 'Вы не можете писать в чат' }, { status: 403 })
  if (sub.chatBanned) return NextResponse.json({ error: 'Вы заблокированы в чате' }, { status: 403 })

  // Рейт-лимит: последнее сообщение этого подписчика не ближе 1.5с.
  const recent = await payload.find({
    collection: 'stream-messages' as any,
    where: { and: [{ tenant: { equals: tenantId } }, { subscriber: { equals: sub.id } }] },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const last = recent.docs[0] as any
  if (last && Date.now() - new Date(last.createdAt).getTime() < 1500) {
    return NextResponse.json({ error: 'Слишком часто, подождите секунду' }, { status: 429 })
  }

  const name = String(sub.displayName || (sub.email ? String(sub.email).split('@')[0] : '') || 'Зритель').slice(0, 60)
  try {
    const doc = (await payload.create({
      collection: 'stream-messages' as any,
      data: { tenant: tenantId, stream: stream.id, subscriber: sub.id, name, text } as any,
      overrideAccess: true,
    })) as any
    return NextResponse.json({ ok: true, message: { id: doc.id, name, text, at: doc.createdAt, mine: true, hidden: false } })
  } catch {
    return NextResponse.json({ error: 'Не удалось отправить' }, { status: 500 })
  }
}
