import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { getTenantFromHeaders } from '@/lib/tenant'
import { credsFromSettings, buildReceipt, createInitialPayment } from '@/lib/yookassa'

/**
 * Оформление подписки: авторизованный подписчик выбирает уровень → создаём
 * первый платёж на магазине ЮKassa ТЕНАНТА (с сохранением карты для автосписаний),
 * пишем subscription-payments(pending) и отдаём confirmationUrl (редирект на ЮKassa).
 * Активацию подписки делает вебхук после успешной оплаты — телу редиректа не верим.
 *
 * Body: { tierId }
 * Ответ: { confirmationUrl } | { error }
 */
export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  const sub = await getCurrentSubscriber()
  if (!sub) return NextResponse.json({ error: 'Войдите, чтобы оформить подписку', needAuth: true }, { status: 401 })

  const ctx = await getTenantFromHeaders()
  if (!ctx) return NextResponse.json({ error: 'Тенант не определён' }, { status: 400 })
  const { tenant, settings } = ctx

  const creds = credsFromSettings(settings)
  if (!creds) return NextResponse.json({ error: 'Приём платежей пока не настроен автором' }, { status: 503 })

  let body: any = {}
  try { body = await req.json() } catch { /* пусто */ }
  const tierId = body?.tierId
  if (!tierId) return NextResponse.json({ error: 'Не указан уровень подписки' }, { status: 400 })

  const payload = await getPayload({ config: await config })

  // Уровень должен принадлежать этому тенанту и быть активным.
  const tier: any = await payload
    .findByID({ collection: 'subscription-tiers', id: tierId, depth: 0, overrideAccess: true })
    .catch(() => null)
  const tTenant = tier && (typeof tier.tenant === 'object' ? tier.tenant?.id : tier.tenant)
  if (!tier || String(tTenant) !== String(tenant.id) || tier.isActive === false) {
    return NextResponse.json({ error: 'Уровень подписки не найден' }, { status: 404 })
  }

  const amountRub = Number(tier.priceRub || 0)
  if (!(amountRub > 0)) return NextResponse.json({ error: 'Некорректная цена уровня' }, { status: 400 })

  const host = req.headers.get('host') || ''
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
        tenantId: String(tenant.id),
        subscriberId: String((sub as any).id),
        tierId: String(tier.id),
        kind: 'subscription_initial',
      },
      receipt,
    })

    // История/идемпотентность: запись pending с id платежа ЮKassa.
    await payload.create({
      collection: 'subscription-payments',
      data: {
        tenant: tenant.id,
        subscriber: (sub as any).id,
        tier: tier.id,
        amountRub,
        status: 'pending',
        yookassaPaymentId: pay.id,
        isRecurring: false,
      } as any,
      overrideAccess: true,
    }).catch(() => { /* запись не критична для редиректа */ })

    if (!pay.confirmationUrl) {
      return NextResponse.json({ error: 'ЮKassa не вернула ссылку на оплату' }, { status: 502 })
    }
    return NextResponse.json({ confirmationUrl: pay.confirmationUrl })
  } catch (e: any) {
    return NextResponse.json({ error: `Не удалось создать платёж: ${e?.message || e}` }, { status: 502 })
  }
}
