import { NextResponse } from 'next/server'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { resolvePayContext } from '@/lib/payContext'
import { credsFromSettings, buildReceipt, createInitialPayment } from '@/lib/yookassa'

/**
 * Оформление подписки: авторизованный подписчик выбирает уровень → создаём
 * первый платёж на магазине ЮKassa ТЕНАНТА (с сохранением карты для автосписаний),
 * пишем subscription-payments(pending) и отдаём confirmationUrl (редирект на ЮKassa).
 * Активацию делает вебхук после успешной оплаты — телу редиректа не верим.
 *
 * Тенант — по ХОСТУ (на /api/* нет x-tenant-id), tenantId передаём в
 * getCurrentSubscriber, иначе он не увидит вошедшего.
 *
 * Body: { tierId } → { confirmationUrl } | { error }
 */
export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  const pc = await resolvePayContext(req)
  if (!pc) return NextResponse.json({ error: 'Тенант не определён' }, { status: 400 })
  const { payload, tenantId, tenant, settings } = pc

  const sub = await getCurrentSubscriber(tenantId)
  if (!sub) return NextResponse.json({ error: 'Войдите, чтобы оформить подписку', needAuth: true }, { status: 401 })

  const creds = credsFromSettings(settings)
  if (!creds) return NextResponse.json({ error: 'Приём платежей пока не настроен автором' }, { status: 503 })

  let body: any = {}
  try { body = await req.json() } catch { /* пусто */ }
  const tierId = body?.tierId
  if (!tierId) return NextResponse.json({ error: 'Не указан уровень подписки' }, { status: 400 })

  const tier: any = await payload.findByID({ collection: 'subscription-tiers', id: tierId, depth: 0, overrideAccess: true }).catch(() => null)
  const tTenant = tier && (typeof tier.tenant === 'object' ? tier.tenant?.id : tier.tenant)
  if (!tier || String(tTenant) !== String(tenantId) || tier.isActive === false) {
    return NextResponse.json({ error: 'Уровень подписки не найден' }, { status: 404 })
  }

  const amountRub = Number(tier.priceRub || 0)
  if (!(amountRub > 0)) return NextResponse.json({ error: 'Некорректная цена уровня' }, { status: 400 })

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  const returnUrl = `https://${host}/account/subscription?paid=1`
  const description = `Подписка «${tier.name}» — ${tenant.name}`.slice(0, 128)

  const receipt = buildReceipt({
    email: (sub as any).email || null,
    phone: (sub as any).phone || null,
    description,
    amountRub,
    taxSystem: (settings as any)?.yookassaTaxSystem ?? null,
    vatCode: (settings as any)?.yookassaVatCode ?? null,
  })

  try {
    const pay = await createInitialPayment(creds, {
      amountRub,
      description,
      returnUrl,
      metadata: {
        tenantId: String(tenantId),
        subscriberId: String((sub as any).id),
        tierId: String(tier.id),
        kind: 'subscription_initial',
      },
      receipt,
    })

    await payload.create({
      collection: 'subscription-payments',
      data: {
        tenant: Number(tenantId),
        subscriber: (sub as any).id,
        tier: tier.id,
        amountRub,
        status: 'pending',
        yookassaPaymentId: pay.id,
        isRecurring: false,
      } as any,
      overrideAccess: true,
    }).catch(() => { /* запись не критична для редиректа */ })

    if (!pay.confirmationUrl) return NextResponse.json({ error: 'ЮKassa не вернула ссылку на оплату' }, { status: 502 })
    return NextResponse.json({ confirmationUrl: pay.confirmationUrl })
  } catch (e: any) {
    return NextResponse.json({ error: `Не удалось создать платёж: ${e?.message || e}` }, { status: 502 })
  }
}
