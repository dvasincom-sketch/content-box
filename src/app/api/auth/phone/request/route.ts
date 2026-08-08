import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { normalizePhone } from '@/lib/phone'
import { tenantIdByHost } from '@/lib/tenantByHost'
import { smsEnabled, sendSms } from '@/lib/smsru'
import { issueCode } from '@/lib/otpStore'
import { verifyTrusted, TRUSTED_COOKIE } from '@/lib/trustedDevice'
import { buildSubscriberSessionCookie } from '@/lib/subscriberSession'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Шаг 1 входа по телефону. Резолвит тенанта по хосту, при доверенном
 * устройстве логинит сразу (без SMS), иначе шлёт 6-значный код.
 */
export async function POST(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  const tenantId = await tenantIdByHost(host).catch(() => null)
  if (!tenantId) return NextResponse.json({ error: 'Не удалось определить сайт' }, { status: 400 })

  let body: { phone?: string } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const phone = normalizePhone(body?.phone || '')
  if (!phone) return NextResponse.json({ error: 'Неверный номер телефона' }, { status: 400 })

  const payload = await getPayload({ config: await config })

  // Доверенное устройство → вход без SMS
  const trustedId = verifyTrusted(req.cookies.get(TRUSTED_COOKIE)?.value, tenantId, phone)
  if (trustedId) {
    const found = await payload.find({
      collection: 'subscribers',
      where: { and: [{ tenant: { equals: tenantId } }, { id: { equals: trustedId } }, { phone: { equals: phone } }] },
      limit: 1,
      overrideAccess: true,
    })
    const sub = found.docs[0]
    if (sub) {
      const cookie = await buildSubscriberSessionCookie(payload, sub.id)
      const res = NextResponse.json({ ok: true, loggedIn: true })
      res.headers.append('Set-Cookie', cookie)
      return res
    }
  }

  if (!smsEnabled()) return NextResponse.json({ error: 'Вход по SMS временно недоступен' }, { status: 503 })

  const issued = issueCode(tenantId, phone, payload.secret)
  if (!issued.ok) {
    const msg = issued.reason === 'cooldown' ? 'Код уже отправлен, повторите позже.' : 'Слишком много попыток, попробуйте позже.'
    return NextResponse.json({ error: msg, retryAfterSec: issued.retryAfterSec }, { status: 429 })
  }

  const sent = await sendSms(phone, `Код для входа: ${issued.code}`)
  if (!sent.ok) return NextResponse.json({ error: 'Не удалось отправить SMS' }, { status: 502 })

  return NextResponse.json({ ok: true, codeSent: true })
}
