import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { normalizePhone } from '@/lib/phone'
import { verifyCode } from '@/lib/otpStore'
import { verifyLinkTicket } from '@/lib/linkTicket'
import { buildUserSessionCookie } from '@/lib/userSession'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const LINK_SCOPE = 'author-email-link'

/**
 * Привязка телефона к СУЩЕСТВУЮЩЕМУ аккаунту по e-mail. Вызывается после
 * register-author-phone, вернувшего needsLink. Тикет подтверждает, что телефон
 * был проверен SMS; код — что e-mail принадлежит пользователю. Результат — phone
 * привязан к аккаунту и выставлена его сессия.
 *
 * Тело: { ticket, code }.
 */
export async function POST(req: NextRequest) {
  let body: { ticket?: string; code?: string } = {}
  try { body = await req.json() } catch { body = {} }
  const ticket = String(body.ticket || '')
  const code = String(body.code || '').replace(/\D/g, '')

  const payload = await getPayload({ config: await config })
  const t = verifyLinkTicket(ticket, payload.secret)
  if (!t) return NextResponse.json({ error: 'Сессия привязки истекла. Начните заново.' }, { status: 400 })
  const phone = normalizePhone(t.phone)
  const email = t.email.toLowerCase()
  if (!phone) return NextResponse.json({ error: 'Некорректный номер.' }, { status: 400 })
  if (code.length < 4) return NextResponse.json({ error: 'Введите код с почты.' }, { status: 400 })

  const vr = verifyCode(LINK_SCOPE, email, code, payload.secret)
  if (vr !== 'ok') {
    const map: Record<string, string> = { invalid: 'Неверный код', expired: 'Код истёк, запросите новый', too_many: 'Слишком много попыток, запросите новый код' }
    return NextResponse.json({ error: map[vr] || 'Ошибка кода' }, { status: 400 })
  }

  const found = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
  const user = found.docs[0] as { id: string | number; disabled?: boolean } | undefined
  if (!user) return NextResponse.json({ error: 'Аккаунт с этим e-mail не найден.' }, { status: 404 })
  if (user.disabled) return NextResponse.json({ error: 'Аккаунт отключён.' }, { status: 403 })

  const phoneDup = await payload.find({ collection: 'users', where: { phone: { equals: phone } }, limit: 1, depth: 0, overrideAccess: true })
  const other = phoneDup.docs[0] as { id: string | number } | undefined
  if (other && String(other.id) !== String(user.id)) {
    return NextResponse.json({ error: 'Этот номер уже привязан к другому аккаунту.' }, { status: 409 })
  }

  try {
    await payload.update({ collection: 'users', id: user.id, data: { phone, phoneVerified: true, emailVerified: true } as never, overrideAccess: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Не удалось привязать номер.' }, { status: 400 })
  }

  const cookie = await buildUserSessionCookie(payload, user.id)
  const res = NextResponse.json({ ok: true })
  res.headers.append('Set-Cookie', cookie)
  return res
}
