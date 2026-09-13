import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { tenantIdByHost } from '@/lib/tenantByHost'
import { readTrusted, signTrusted, TRUSTED_COOKIE, TRUSTED_MAX_AGE_SEC } from '@/lib/trustedDevice'
import { buildSubscriberSessionCookie } from '@/lib/subscriberSession'
import { isSyntheticEmail } from '@/lib/authEmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Вход по доверенному устройству без ввода телефона и без SMS. Читаем
 * подписанную куки `cb_td` (её ставит verify при «запомнить устройство»),
 * достаём из неё телефон + id подписчика, сверяем с записью тенанта и минтим
 * сессию. Используется кнопкой «Продолжить как …» на /login, когда сессия
 * истекла/слетела, а браузер ещё помнит аккаунт.
 */
export async function POST(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  const tenantId = await tenantIdByHost(host).catch(() => null)
  if (!tenantId) return NextResponse.json({ error: 'Не удалось определить сайт' }, { status: 400 })

  const trusted = readTrusted(req.cookies.get(TRUSTED_COOKIE)?.value, tenantId)
  if (!trusted) return NextResponse.json({ error: 'Устройство не распознано' }, { status: 401 })

  const payload = await getPayload({ config: await config })
  const found = await payload.find({
    collection: 'subscribers',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { id: { equals: trusted.subscriberId } },
        { phone: { equals: trusted.phone } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })
  const sub = found.docs[0]
  if (!sub) return NextResponse.json({ error: 'Аккаунт не найден' }, { status: 404 })

  const cookie = await buildSubscriberSessionCookie(payload, sub.id)
  // Нужен ли ещё реальный подтверждённый email (для промпта сразу после входа).
  const needsEmail =
    isSyntheticEmail((sub as { email?: string }).email) || !(sub as { emailVerified?: boolean }).emailVerified
  const res = NextResponse.json({ ok: true, loggedIn: true, needsEmail })
  res.headers.append('Set-Cookie', cookie)
  // Продлеваем доверие устройства ещё на 30 дней от момента входа.
  const td = signTrusted(tenantId, trusted.phone, String(sub.id))
  const secure = process.env.NODE_ENV === 'production'
  res.headers.append(
    'Set-Cookie',
    `${TRUSTED_COOKIE}=${td}; Path=/; Max-Age=${TRUSTED_MAX_AGE_SEC}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`,
  )
  return res
}
