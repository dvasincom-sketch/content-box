import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { normalizePhone } from '@/lib/phone'
import { verifyCode } from '@/lib/otpStore'
import { buildUserSessionCookie } from '@/lib/userSession'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const SCOPE = 'studio'

/**
 * Шаг 2 входа автора по телефону: проверяем код, находим автора по phone,
 * минтим авторскую сессию. Только для существующих (регистрация — отдельный роут).
 */
export async function POST(req: NextRequest) {
  let body: { phone?: string; code?: string } = {}
  try { body = await req.json() } catch { body = {} }
  const phone = normalizePhone(body?.phone || '')
  const code = String(body?.code || '').replace(/\D/g, '')
  if (!phone || code.length < 4) return NextResponse.json({ error: 'Неверные данные' }, { status: 400 })

  const payload = await getPayload({ config: await config })
  const result = verifyCode(SCOPE, phone, code, payload.secret)
  if (result !== 'ok') {
    const map: Record<string, string> = { invalid: 'Неверный код', expired: 'Код истёк, запросите новый', too_many: 'Слишком много попыток, запросите новый код' }
    return NextResponse.json({ error: map[result] || 'Ошибка' }, { status: 400 })
  }

  const found = await payload.find({ collection: 'users', where: { phone: { equals: phone } }, limit: 1, depth: 0, overrideAccess: true })
  const user = found.docs[0] as { id: string | number; disabled?: boolean; phoneVerified?: boolean } | undefined
  if (!user) return NextResponse.json({ error: 'Аккаунта с этим номером нет.' }, { status: 404 })
  if (user.disabled) return NextResponse.json({ error: 'Аккаунт отключён.' }, { status: 403 })
  if (!user.phoneVerified) {
    await payload.update({ collection: 'users', id: user.id, data: { phoneVerified: true } as never, overrideAccess: true }).catch(() => {})
  }

  const cookie = await buildUserSessionCookie(payload, user.id)
  const res = NextResponse.json({ ok: true })
  res.headers.append('Set-Cookie', cookie)
  return res
}
