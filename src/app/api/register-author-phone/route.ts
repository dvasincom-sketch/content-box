import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import { randomBytes } from 'crypto'
import config from '@/payload.config'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rateLimit'
import { RESERVED_SUBDOMAINS, isValidSubdomain, domainFromSubdomain } from '@/lib/subdomain'
import { normalizePhone, formatPhone } from '@/lib/phone'
import { verifyCode } from '@/lib/otpStore'
import { buildUserSessionCookie } from '@/lib/userSession'
import { sendEmailCode } from '@/lib/emailOtp'
import { signLinkTicket } from '@/lib/linkTicket'

/**
 * Регистрация АВТОРА по номеру телефона (основной ID). Телефон подтверждается
 * SMS-кодом (scope 'studio', mode='register'). На шаге 2 указывается имя
 * (обязательно) и e-mail (опционально).
 *
 * Тело: { name (req), phone, code, email? }.
 * - email пуст → внутренний синтетический email (${phone}@phone.contentbox.local).
 * - email свободен → создаём с реальным email, emailVerified=false, шлём письмо-код
 *   (не блокирует), логин.
 * - email ЗАНЯТ → проект НЕ создаём; шлём код на этот e-mail и возвращаем
 *   { needsLink, email, ticket } — привязка телефона к тому аккаунту идёт через
 *   /studio/api/auth/phone/link-email.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SCOPE = 'studio'
const LINK_SCOPE = 'author-email-link'
const VERIFY_SCOPE = 'author-email'
const TENANT_NAME_PLACEHOLDER = 'Новый проект'
const MAX_SUBDOMAIN_TRIES = 50
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PW_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generatePassword(len = 20): string {
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += PW_ALPHABET[bytes[i] % PW_ALPHABET.length]
  return out
}
function randomSubBase(): string {
  return 'p' + randomBytes(5).toString('hex').slice(0, 8)
}
async function findFreeSubdomain(payload: Payload, base: string): Promise<string | null> {
  const root = base && base.length >= 3 ? base.slice(0, 27) : randomSubBase()
  for (let i = 0; i < MAX_SUBDOMAIN_TRIES; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`
    if (!isValidSubdomain(candidate) || RESERVED_SUBDOMAINS.has(candidate)) continue
    const taken = await payload.find({ collection: 'tenants', where: { subdomain: { equals: candidate } }, limit: 1, depth: 0, overrideAccess: true })
    if (taken.docs.length === 0) return candidate
  }
  return null
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers)
  const rl = rateLimit(`register-author-phone:${ip}`, 10, 60 * 60 * 1000)
  if (!rl.ok) return tooManyRequests(rl.retryAfter, 'Слишком много регистраций с этого адреса. Попробуйте позже.')

  let body: { name?: string; phone?: string; code?: string; email?: string } = {}
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Некорректный запрос.' }, { status: 400 }) }

  const name = (body.name || '').trim()
  const phone = normalizePhone(body.phone || '')
  const code = String(body.code || '').replace(/\D/g, '')
  const email = (body.email || '').trim().toLowerCase()
  if (!name) return NextResponse.json({ error: 'Укажите имя.' }, { status: 400 })
  if (!phone) return NextResponse.json({ error: 'Укажите корректный номер телефона.' }, { status: 400 })
  if (code.length < 4) return NextResponse.json({ error: 'Введите код из SMS.' }, { status: 400 })
  if (email && !EMAIL_RE.test(email)) return NextResponse.json({ error: 'Некорректный e-mail.' }, { status: 400 })

  const payload = await getPayload({ config: await config })

  const vr = verifyCode(SCOPE, phone, code, payload.secret)
  if (vr !== 'ok') {
    const map: Record<string, string> = { invalid: 'Неверный код', expired: 'Код истёк, запросите новый', too_many: 'Слишком много попыток, запросите новый код' }
    return NextResponse.json({ error: map[vr] || 'Ошибка кода' }, { status: 400 })
  }

  const dup = await payload.find({ collection: 'users', where: { phone: { equals: phone } }, limit: 1, depth: 0, overrideAccess: true })
  if (dup.docs.length > 0) return NextResponse.json({ error: 'Этот номер уже используется. Войдите.' }, { status: 409 })

  // E-mail занят → не создаём проект, предлагаем привязать телефон к тому аккаунту.
  if (email) {
    const byEmail = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
    if (byEmail.docs.length > 0) {
      const sent = await sendEmailCode(payload, LINK_SCOPE, email, 'link')
      if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 })
      const ticket = signLinkTicket({ phone, email }, payload.secret)
      return NextResponse.json({ ok: true, needsLink: true, email, ticket })
    }
  }

  const subdomain = await findFreeSubdomain(payload, randomSubBase())
  if (!subdomain) return NextResponse.json({ error: 'Не удалось создать проект. Попробуйте ещё раз.' }, { status: 500 })

  let tenantId: number | string
  try {
    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: TENANT_NAME_PLACEHOLDER, subdomain, domain: domainFromSubdomain(subdomain),
        domainVerified: true, status: 'active', onboardingStep: 0, onboardingComplete: false,
      } as any,
      overrideAccess: true,
    })
    tenantId = tenant.id
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Не удалось создать проект.' }, { status: 400 })
  }

  let userId: number | string
  try {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: email || `${phone}@phone.contentbox.local`,
        password: generatePassword(),
        name,
        phone,
        phoneVerified: true,
        emailVerified: false,
        tenant: tenantId,
        tenantRole: 'editor',
      } as any,
      overrideAccess: true,
    })
    userId = user.id
  } catch (e) {
    await payload.delete({ collection: 'tenants', id: tenantId, overrideAccess: true }).catch(() => {})
    const raw = (e as Error).message || ''
    const msg = /phone/i.test(raw) ? 'Этот номер уже используется.' : /email/i.test(raw) ? 'Этот e-mail уже используется.' : raw || 'Не удалось создать аккаунт.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  try {
    await payload.create({ collection: 'site-settings', data: { tenant: tenantId } as any, overrideAccess: true })
  } catch {
    await payload.delete({ collection: 'users', id: userId, overrideAccess: true }).catch(() => {})
    await payload.delete({ collection: 'tenants', id: tenantId, overrideAccess: true }).catch(() => {})
    return NextResponse.json({ error: 'Не удалось инициализировать проект. Попробуйте ещё раз.' }, { status: 500 })
  }

  // Реальный e-mail — шлём код подтверждения (не блокирует вход).
  if (email) { await sendEmailCode(payload, VERIFY_SCOPE, email, 'verify').catch(() => {}) }

  const cookie = await buildUserSessionCookie(payload, userId)
  const res = NextResponse.json({ ok: true, phone: formatPhone(phone) })
  res.headers.append('Set-Cookie', cookie)
  return res
}
