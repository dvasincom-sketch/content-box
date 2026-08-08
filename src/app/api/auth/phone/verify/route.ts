import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { randomBytes } from 'crypto'
import config from '@/payload.config'
import { normalizePhone, formatPhone } from '@/lib/phone'
import { tenantIdByHost } from '@/lib/tenantByHost'
import { verifyCode } from '@/lib/otpStore'
import { buildSubscriberSessionCookie } from '@/lib/subscriberSession'
import { signTrusted, TRUSTED_COOKIE, TRUSTED_MAX_AGE_SEC } from '@/lib/trustedDevice'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Шаг 2 входа по телефону. Проверяет код, находит/создаёт подписчика по
 * (tenant, phone), минтит сессию и (по умолчанию) ставит куки доверенного
 * устройства на 30 дней.
 */
export async function POST(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  const tenantId = await tenantIdByHost(host).catch(() => null)
  if (!tenantId) return NextResponse.json({ error: 'Не удалось определить сайт' }, { status: 400 })

  let body: { phone?: string; code?: string; remember?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const phone = normalizePhone(body?.phone || '')
  const code = String(body?.code || '').replace(/\D/g, '')
  const remember = body?.remember !== false
  if (!phone || code.length < 4) return NextResponse.json({ error: 'Неверные данные' }, { status: 400 })

  const payload = await getPayload({ config: await config })
  const result = verifyCode(tenantId, phone, code, payload.secret)
  if (result !== 'ok') {
    const map: Record<string, string> = {
      invalid: 'Неверный код',
      expired: 'Код истёк, запросите новый',
      too_many: 'Слишком много попыток, запросите новый код',
    }
    return NextResponse.json({ error: map[result] || 'Ошибка' }, { status: 400 })
  }

  // find-or-create подписчика по (tenant, phone)
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
        displayName: formatPhone(phone),
        tenant: tenantId,
        emailVerified: true,
      } as never,
      overrideAccess: true,
    })
  } else if (!(sub as { phoneVerified?: boolean }).phoneVerified) {
    await payload.update({ collection: 'subscribers', id: sub.id, data: { phoneVerified: true } as never, overrideAccess: true })
  }

  const cookie = await buildSubscriberSessionCookie(payload, sub.id)
  const res = NextResponse.json({ ok: true })
  res.headers.append('Set-Cookie', cookie)
  if (remember) {
    const td = signTrusted(tenantId, phone, String(sub.id))
    const secure = process.env.NODE_ENV === 'production'
    res.headers.append(
      'Set-Cookie',
      `${TRUSTED_COOKIE}=${td}; Path=/; Max-Age=${TRUSTED_MAX_AGE_SEC}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`,
    )
  }
  return res
}
