import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { credsFromSettings, getPayment } from '@/lib/yookassa'

/**
 * Вебхук ЮKassa. Тенант берём из metadata.tenantId, креды — из его site-settings,
 * и ПЕРЕЗАПРАШИВАЕМ платёж через API (телу уведомления не доверяем). На
 * payment.succeeded идемпотентно (по yookassaPaymentId) активируем подписку:
 * ставим activeTier, продлеваем subscriptionUntil на месяц, сохраняем способ
 * оплаты для автосписаний. Всегда отвечаем 200, иначе ЮKassa будет ретраить.
 *
 * URL для настройки в ЛК ЮKassa: https://<домен>/api/pay/webhook
 * События: payment.succeeded, payment.canceled, refund.succeeded.
 */
export const runtime = 'nodejs'

const ok = () => NextResponse.json({ ok: true })

export async function POST(req: Request): Promise<Response> {
  let body: any = {}
  try { body = await req.json() } catch { return ok() }

  const event = String(body?.event || '')
  const obj = body?.object || {}
  const paymentId = String(obj?.id || '')
  const tenantId = obj?.metadata?.tenantId
  if (!paymentId || !tenantId) return ok()

  const payload = await getPayload({ config: await config })

  // Креды тенанта.
  const sres = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: tenantId } },
    limit: 1, depth: 0, overrideAccess: true,
  }).catch(() => ({ docs: [] as any[] }))
  const settings = sres.docs[0]
  const creds = credsFromSettings(settings)
  if (!creds) return ok() // не можем верифицировать — молча подтверждаем

  // Верификация: перезапрашиваем платёж, доверяем ТОЛЬКО этому ответу.
  let pay
  try { pay = await getPayment(creds, paymentId) } catch { return ok() }

  const meta = pay.metadata || obj.metadata || {}
  const subscriberId = meta.subscriberId
  const tierId = meta.tierId

  // Существующая запись истории (идемпотентность).
  const existingRes = await payload.find({
    collection: 'subscription-payments',
    where: { and: [{ tenant: { equals: tenantId } }, { yookassaPaymentId: { equals: paymentId } }] },
    limit: 1, depth: 0, overrideAccess: true,
  }).catch(() => ({ docs: [] as any[] }))
  const existing: any = existingRes.docs[0] || null

  // Отмена/возврат — помечаем запись, подписку не активируем.
  if (event === 'payment.canceled' || pay.status === 'canceled') {
    if (existing && existing.status !== 'succeeded') {
      await payload.update({ collection: 'subscription-payments', id: existing.id, data: { status: 'canceled' } as any, overrideAccess: true }).catch(() => {})
    }
    return ok()
  }
  if (event === 'refund.succeeded') {
    if (existing) await payload.update({ collection: 'subscription-payments', id: existing.id, data: { status: 'refunded' } as any, overrideAccess: true }).catch(() => {})
    return ok()
  }

  // Успех.
  if (pay.status !== 'succeeded') return ok()
  if (existing && existing.status === 'succeeded') return ok() // уже обработан

  // Запись истории → succeeded (или создаём, если её не было).
  if (existing) {
    await payload.update({ collection: 'subscription-payments', id: existing.id, data: { status: 'succeeded' } as any, overrideAccess: true }).catch(() => {})
  } else if (subscriberId && tierId) {
    await payload.create({
      collection: 'subscription-payments',
      data: {
        tenant: tenantId,
        subscriber: Number(subscriberId),
        tier: Number(tierId),
        amountRub: pay.amount ? Number(pay.amount.value) : 0,
        status: 'succeeded',
        yookassaPaymentId: paymentId,
        isRecurring: meta.kind === 'subscription_renewal',
      } as any,
      overrideAccess: true,
    }).catch(() => {})
  }

  // Активация подписки у подписчика.
  if (subscriberId && tierId) {
    const subscriber: any = await payload
      .findByID({ collection: 'subscribers', id: subscriberId, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (subscriber && String(relId(subscriber.tenant)) === String(tenantId)) {
      const now = new Date()
      const cur = subscriber.subscriptionUntil ? new Date(subscriber.subscriptionUntil) : null
      const base = cur && cur > now ? cur : now
      const until = new Date(base)
      until.setMonth(until.getMonth() + 1) // тариф помесячный

      const cardLabel = cardMask(pay)
      const methodId = pay.payment_method?.id || null

      await payload.update({
        collection: 'subscribers',
        id: subscriber.id,
        data: {
          activeTier: Number(tierId),
          subscriptionUntil: until.toISOString(),
          autoRenew: true,
          lastPaymentAt: now.toISOString(),
          ...(methodId ? { yookassaPaymentMethodId: methodId } : {}),
          ...(cardLabel ? { cardLabel } : {}),
          ...(subscriber.subscriptionSince ? {} : { subscriptionSince: now.toISOString() }),
        } as any,
        overrideAccess: true,
      }).catch(() => {})
    }
  }

  return ok()
}

function relId(v: unknown): string | null {
  if (v == null) return null
  const raw = typeof v === 'object' ? (v as any).id : v
  return raw == null ? null : String(raw)
}
function cardMask(pay: any): string | null {
  const card = pay?.payment_method?.card
  if (card?.last4) return `${String(card.card_type || 'Карта').toUpperCase()} ****${card.last4}`
  return pay?.payment_method?.title || null
}
