import { NextResponse } from 'next/server'
import { resolvePayContext } from '@/lib/payContext'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { checkPublicationAccess } from '@/lib/publicationAccess'

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

async function isOwner(tenantId: string): Promise<boolean> {
  const author = await getCurrentAuthor().catch(() => null)
  return Boolean(
    author &&
      Number(author.tenantId) === Number(tenantId) &&
      (author.user as { tenantRole?: string | null })?.tenantRole !== 'contributor',
  )
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
  const owner = await isOwner(tenantId)
  if (!access.allowed && !owner) {
    return NextResponse.json({ messages: [], canPost: false, canModerate: false, needAccess: true })
  }

  const and: any[] = [{ tenant: { equals: tenantId } }, { stream: { equals: stream.id } }]
  if (after > 0) and.push({ id: { greater_than: after } })
  if (!owner) and.push({ hidden: { not_equals: true } })

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
    mine: mySubId ? String(m.subscriber) === mySubId : false,
  }))
  const blocked = access.allowed && (access as any).subscriber?.isBlocked
  return NextResponse.json({ messages, canPost: access.allowed && !blocked, canModerate: owner })
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
