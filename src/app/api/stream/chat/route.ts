import { NextResponse } from 'next/server'
import { resolvePayContext } from '@/lib/payContext'
import { checkPublicationAccess } from '@/lib/publicationAccess'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { moderatorFor, normModEmails, normModIds } from './_mod'
import { maskIfPhone, looksLikePhone, formatPhone } from '@/lib/phone'

// Чат закрывается через час после окончания эфира.
const CHAT_GRACE_MS = 60 * 60 * 1000

/** Открытая трансляция — доступ всем; иначе доступ по тарифу. */
async function accessFor(stream: any, tenantId: string): Promise<{ allowed: boolean; subscriber: any | null; reason?: string }> {
  if (stream?.isOpen) {
    const subscriber = await getCurrentSubscriber(String(tenantId)).catch(() => null)
    return { allowed: true, subscriber }
  }
  return checkPublicationAccess(stream) as any
}

/** Прошёл ли час после окончания эфира (чат закрыт для записи). */
function chatClosed(stream: any): boolean {
  const end = stream?.endsAt ? Date.parse(stream.endsAt) : NaN
  return Number.isFinite(end) && Date.now() > end + CHAT_GRACE_MS
}

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
  const globalModIds = normModIds(pc.settings?.streamModeratorIds)

  const url = new URL(req.url)
  const streamId = url.searchParams.get('stream')
  const after = Number(url.searchParams.get('after') || '0') || 0
  const stream = await loadStream(payload, tenantId, streamId)
  if (!stream) return NextResponse.json({ error: 'Трансляция не найдена' }, { status: 404 })
  if (stream.chatEnabled === false) {
    return NextResponse.json({ messages: [], canPost: false, canModerate: false, disabled: true })
  }

  const access = await accessFor(stream, tenantId)
  const mod = await moderatorFor(tenantId, stream, globalModIds)
  const canMod = mod.canModerate
  const closed = chatClosed(stream)
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

  // Флаги авторов сообщений: модератор (email в списке трансляции) и активная
  // подписка — чтобы подсветить их в чате. Считаем по одному запросу.
  const authorIds = Array.from(
    new Set((res.docs as any[]).map((m) => (m.subscriber ? Number(m.subscriber) : null)).filter((x): x is number => x != null)),
  )
  const modEmails = normModEmails(stream.moderatorEmails)
  const modSubIds = new Set<number>()
  const paidSubIds = new Set<number>()
  // Сквозные модераторы (по id) — сразу помечаем среди авторов.
  for (const id of globalModIds) if (authorIds.includes(id)) modSubIds.add(id)
  if (authorIds.length) {
    const a = await payload
      .find({
        collection: 'subscribers',
        where: { and: [{ tenant: { equals: tenantId } }, { id: { in: authorIds } }] },
        limit: 500,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => ({ docs: [] as any[] }))
    for (const s of a.docs as any[]) {
      const email = String(s.email || '').trim().toLowerCase()
      if (email && modEmails.includes(email)) modSubIds.add(Number(s.id))
      const until = s.subscriptionUntil ? Date.parse(s.subscriptionUntil) : 0
      if (s.activeTier && Number.isFinite(until) && until > Date.now()) paidSubIds.add(Number(s.id))
    }
  }

  const mySubId = access.allowed && (access as any).subscriber ? String((access as any).subscriber.id) : null
  const messages = (res.docs as any[]).map((m) => {
    const sid = m.subscriber ? Number(m.subscriber) : null
    return {
      id: m.id,
      name: maskIfPhone(m.name || 'Зритель'),
      text: m.text,
      at: m.createdAt,
      hidden: !!m.hidden,
      pinned: !!m.pinned,
      mine: mySubId ? String(m.subscriber) === mySubId : false,
      mod: sid != null && modSubIds.has(sid),
      paid: sid != null && paidSubIds.has(sid),
      ...(canMod ? { sub: sid } : {}),
    }
  })

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
  const pmSid = pm && pm.subscriber ? Number(pm.subscriber) : null
  const pinned = pm
    ? { id: pm.id, name: maskIfPhone(pm.name || 'Зритель'), text: pm.text, mod: pmSid != null && modSubIds.has(pmSid), paid: pmSid != null && paidSubIds.has(pmSid) }
    : null

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
  const canPost = access.allowed && !!sub && !sub?.isBlocked && !sub?.chatBanned && !closed
  return NextResponse.json({ messages, pinned, canPost, canModerate: canMod, bannedSubscriberIds, closed })
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
  if (chatClosed(stream)) return NextResponse.json({ error: 'Чат закрыт — эфир завершён', closed: true }, { status: 403 })

  const access = await accessFor(stream, tenantId)
  if (!access.allowed) {
    const needLogin = (access as any).reason === 'need-login'
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

  // Снимок имени: псевдоним (если задан и не телефон) → иначе форматированный
  // телефон (в БД, для владельца) → иначе часть email. Публично всё равно
  // маскируется (maskIfPhone) при выдаче.
  const alias = sub.displayName && !looksLikePhone(String(sub.displayName)) ? String(sub.displayName) : ''
  const emailUser = sub.email && !/@phone\.|\.local$/i.test(String(sub.email)) ? String(sub.email).split('@')[0] : ''
  const name = String(alias || (sub.phone ? formatPhone(String(sub.phone)) : '') || emailUser || 'Зритель').slice(0, 60)
  try {
    const doc = (await payload.create({
      collection: 'stream-messages' as any,
      data: { tenant: tenantId, stream: stream.id, subscriber: sub.id, name, text } as any,
      overrideAccess: true,
    })) as any
    return NextResponse.json({ ok: true, message: { id: doc.id, name: maskIfPhone(name), text, at: doc.createdAt, mine: true, hidden: false } })
  } catch {
    return NextResponse.json({ error: 'Не удалось отправить' }, { status: 500 })
  }
}
