import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { normalizePhone } from '@/lib/phone'
import { reserveCode, setCode, clearCode } from '@/lib/otpStore'
import { callEnabled, callCode } from '@/lib/smsru'
import { logSmsSend } from '@/lib/smsLog'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Авторы глобальны (не привязаны к тенанту, как подписчики) — единый scope OTP.
const SCOPE = 'studio'

/**
 * Шаг 1 входа/регистрации автора по телефону: заказываем ЗВОНОК (sms.ru), код —
 * последние цифры входящего номера. mode='login' — нужен существующий автор;
 * mode='register' — телефон должен быть свободен. Проверяем существование ДО
 * звонка, чтобы не жечь лимиты.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers)
  const rl = rateLimit(`studio-phone-req:${ip}`, 6, 60 * 60 * 1000)
  if (!rl.ok) return tooManyRequests(rl.retryAfter, 'Слишком много запросов кода. Попробуйте позже.')

  let body: { phone?: string; mode?: 'login' | 'register' } = {}
  try { body = await req.json() } catch { body = {} }
  const phone = normalizePhone(body?.phone || '')
  const mode = body?.mode === 'register' ? 'register' : 'login'
  if (!phone) return NextResponse.json({ error: 'Укажите корректный номер телефона.' }, { status: 400 })
  if (!callEnabled()) return NextResponse.json({ error: 'Подтверждение по звонку сейчас недоступно.' }, { status: 503 })

  const payload = await getPayload({ config: await config })
  const found = await payload.find({ collection: 'users', where: { phone: { equals: phone } }, limit: 1, depth: 0, overrideAccess: true })
  const exists = found.docs.length > 0
  if (mode === 'login' && !exists) return NextResponse.json({ error: 'Аккаунта с этим номером нет. Зарегистрируйтесь.' }, { status: 404 })
  if (mode === 'register' && exists) return NextResponse.json({ error: 'Этот номер уже используется. Войдите.' }, { status: 409 })

  const reserved = reserveCode(SCOPE, phone)
  if (!reserved.ok) {
    const msg = reserved.reason === 'cooldown' ? 'Звонок уже поступает, повторите позже.' : 'Слишком много попыток, попробуйте позже.'
    return NextResponse.json({ error: msg, retryAfterSec: reserved.retryAfterSec }, { status: 429 })
  }
  const call = await callCode(phone)
  if (!call.ok || !call.code) {
    clearCode(SCOPE, phone)
    await logSmsSend(payload, { tenantId: null, phone, kind: 'studio_login', ok: false })
    return NextResponse.json({ error: 'Не удалось позвонить. Попробуйте позже.' }, { status: 502 })
  }
  setCode(SCOPE, phone, payload.secret, call.code)
  await logSmsSend(payload, { tenantId: null, phone, kind: 'studio_login', ok: true })

  return NextResponse.json({ ok: true, codeSent: true, method: 'call' })
}
