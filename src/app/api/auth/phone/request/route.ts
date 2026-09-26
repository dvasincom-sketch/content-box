import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { normalizePhone } from '@/lib/phone'
import { tenantIdByHost } from '@/lib/tenantByHost'
import { callEnabled, callcheckAdd } from '@/lib/smsru'
import { reserveCode, setCheckId, clearCode, clearCheckId } from '@/lib/otpStore'
import { verifyTrusted, TRUSTED_COOKIE } from '@/lib/trustedDevice'
import { buildSubscriberSessionCookie } from '@/lib/subscriberSession'
import { logSmsSend } from '@/lib/smsLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Шаг 1 входа по телефону. Резолвит тенанта по хосту, при доверенном устройстве
 * логинит сразу. Иначе — авторизация ЗВОНКОМ ОТ КЛИЕНТА: выдаём номер, на который
 * пользователь звонит сам; статус потом опрашивается на /api/auth/phone/callcheck.
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

  if (!callEnabled()) return NextResponse.json({ error: 'Авторизация по звонку временно недоступна' }, { status: 503 })

  const reserved = reserveCode(tenantId, phone)
  if (!reserved.ok) {
    const msg = reserved.reason === 'cooldown' ? 'Заявка уже создана, повторите позже.' : 'Слишком много попыток, попробуйте позже.'
    return NextResponse.json({ error: msg, retryAfterSec: reserved.retryAfterSec }, { status: 429 })
  }

  // Выдаём номер, на который клиент звонит сам. sms.ru опознаёт его по АОН.
  const add = await callcheckAdd(phone)
  if (!add.ok || !add.checkId || !add.callPhone) {
    clearCode(tenantId, phone)
    clearCheckId(tenantId, phone)
    await logSmsSend(payload, { tenantId, phone, kind: 'subscriber_login', ok: false })
    return NextResponse.json({ error: 'Сервис авторизации по звонку недоступен. Попробуйте позже.' }, { status: 502 })
  }
  setCheckId(tenantId, phone, add.checkId)
  await logSmsSend(payload, { tenantId, phone, kind: 'subscriber_login', ok: true })

  return NextResponse.json({ ok: true, awaitCall: true, callPhone: add.callPhone, callPhonePretty: add.callPhonePretty })
}
