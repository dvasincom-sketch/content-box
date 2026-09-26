import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { randomBytes } from 'crypto'
import config from '@/payload.config'
import { normalizePhone } from '@/lib/phone'
import { tenantIdByHost } from '@/lib/tenantByHost'
import { callcheckStatus } from '@/lib/smsru'
import { getCheckId, clearCheckId } from '@/lib/otpStore'
import { buildSubscriberSessionCookie } from '@/lib/subscriberSession'
import { signTrusted, TRUSTED_COOKIE, TRUSTED_MAX_AGE_SEC } from '@/lib/trustedDevice'
import { isSyntheticEmail } from '@/lib/authEmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Опрос статуса авторизации звонком от клиента. Фронт вызывает периодически с
 * { phone }. Пока пользователь не позвонил — { pending:true }. Как позвонил —
 * находим/создаём подписчика по (tenant, phone), логиним и помним устройство.
 */
export async function POST(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  const tenantId = await tenantIdByHost(host).catch(() => null)
  if (!tenantId) return NextResponse.json({ error: 'Не удалось определить сайт' }, { status: 400 })

  let body: { phone?: string } = {}
  try { body = await req.json() } catch { body = {} }
  const phone = normalizePhone(body?.phone || '')
  if (!phone) return NextResponse.json({ error: 'Неверный номер телефона' }, { status: 400 })

  const checkId = getCheckId(tenantId, phone)
  if (!checkId) return NextResponse.json({ error: 'Сессия истекла, начните заново', expired: true }, { status: 410 })

  const st = await callcheckStatus(checkId)
  if (!st.ok) return NextResponse.json({ ok: true, pending: true }) // временная ошибка провайдера — просто ждём дальше
  if (st.state === 'waiting') return NextResponse.json({ ok: true, pending: true })
  if (st.state !== 'confirmed') {
    clearCheckId(tenantId, phone)
    return NextResponse.json({ error: 'Время истекло, начните заново', expired: true }, { status: 410 })
  }

  // Подтверждено звонком → find-or-create подписчика по (tenant, phone).
  const payload = await getPayload({ config: await config })
  clearCheckId(tenantId, phone)

  const existing = await payload.find({
    collection: 'subscribers',
    where: { and: [{ tenant: { equals: tenantId } }, { phone: { equals: phone } }] },
    limit: 1,
    overrideAccess: true,
  })
  let sub = existing.docs[0]
  if (!sub) {
    sub = await payload.create({
      collection: 'subscribers',
      data: {
        email: `${phone}@phone.contentbox.local`,
        password: randomBytes(24).toString('base64url'),
        phone,
        phoneVerified: true,
        tenant: tenantId,
        emailVerified: false,
      } as never,
      overrideAccess: true,
    })
  } else if (!(sub as { phoneVerified?: boolean }).phoneVerified) {
    await payload.update({ collection: 'subscribers', id: sub.id, data: { phoneVerified: true } as never, overrideAccess: true })
  }

  const cookie = await buildSubscriberSessionCookie(payload, sub.id)
  const needsEmail = isSyntheticEmail((sub as { email?: string }).email) || !(sub as { emailVerified?: boolean }).emailVerified
  const res = NextResponse.json({ ok: true, loggedIn: true, needsEmail })
  res.headers.append('Set-Cookie', cookie)
  // Помним устройство 30 дней — вход без звонка при следующем визите.
  const td = signTrusted(tenantId, phone, String(sub.id))
  const secure = process.env.NODE_ENV === 'production'
  res.headers.append('Set-Cookie', `${TRUSTED_COOKIE}=${td}; Path=/; Max-Age=${TRUSTED_MAX_AGE_SEC}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`)
  return res
}
