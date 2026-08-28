import { NextResponse } from 'next/server'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { resolvePayContext } from '@/lib/payContext'
import { credsFromSettings, buildReceipt, createInitialPayment } from '@/lib/yookassa'
import { planChange, type SubState } from '@/lib/subscriptionChange'

/**
 * Оформление / смена уровня подписки. Тенант — по ХОСТУ (на /api/* нет
 * x-tenant-id), tenantId передаём в getCurrentSubscriber.
 *
 * Сценарии (см. lib/subscriptionChange):
 *  • initial  — нет активной подписки → первый платёж на полную цену (+месяц),
 *               карта сохраняется для автосписаний. Активирует вебхук.
 *  • upgrade  — новый уровень дороже → доплата за остаток по разнице; дата
 *               окончания не меняется, уровень поднимает вебхук после оплаты.
 *  • downgrade + mode:'next' (по умолчанию) — без списания, планируем pendingTier
 *               (применится при автопродлении). Отвечаем { scheduled }.
 *  • downgrade + mode:'now' — без списания, переключаем сразу и продлеваем дату
 *               окончания (остаток → доп. дни по новой цене). Отвечаем { switched }.
 *  • same     — уже оформлен этот уровень → ошибка.
 *
 * Body: { tierId, mode?: 'now'|'next' }
 * Ответ: { confirmationUrl } | { scheduled, until } | { switched, until } | { error }
 */
export const runtime = 'nodejs'

const DAY_MS = 86_400_000

export async function POST(req: Request): Promise<Response> {
  const pc = await resolvePayContext(req)
  if (!pc) return NextResponse.json({ error: 'Тенант не определён' }, { status: 400 })
  const { payload, tenantId, tenant, settings } = pc

  const sub = await getCurrentSubscriber(tenantId)
  if (!sub) return NextResponse.json({ error: 'Войдите, чтобы оформить подписку', needAuth: true }, { status: 401 })

  let body: any = {}
  try { body = await req.json() } catch { /* пусто */ }
  const tierId = body?.tierId
  const mode: 'now' | 'next' = body?.mode === 'now' ? 'now' : 'next'
  if (!tierId) return NextResponse.json({ error: 'Не указан уровень подписки' }, { status: 400 })

  const tier: any = await payload.findByID({ collection: 'subscription-tiers', id: tierId, depth: 0, overrideAccess: true }).catch(() => null)
  const tTenant = tier && (typeof tier.tenant === 'object' ? tier.tenant?.id : tier.tenant)
  if (!tier || String(tTenant) !== String(tenantId) || tier.isActive === false) {
    return NextResponse.json({ error: 'Уровень подписки не найден' }, { status: 404 })
  }
  const amountRub = Number(tier.priceRub || 0)
  if (!(amountRub > 0)) return NextResponse.json({ error: 'Некорректная цена уровня' }, { status: 400 })

  // Текущее состояние подписки.
  const activeTierId = ((): number | null => {
    const v = (sub as any).activeTier
    const id = v && typeof v === 'object' ? v.id : v
    return id != null ? Number(id) : null
  })()
  const until = (sub as any).subscriptionUntil ? new Date((sub as any).subscriptionUntil) : null
  let activePriceRub = 0
  if (activeTierId != null) {
    const curTier: any = await payload.findByID({ collection: 'subscription-tiers', id: activeTierId, depth: 0, overrideAccess: true }).catch(() => null)
    activePriceRub = Number(curTier?.priceRub || 0)
  }
  const state: SubState = { activeTierId, activePriceRub, until }
  const now = new Date()
  const plan = planChange({ id: tier.id, priceRub: amountRub }, state, now)

  // ── Уже оформлен этот уровень ────────────────────────────────────────────
  if (plan.kind === 'same') {
    return NextResponse.json({ error: 'У вас уже оформлена эта подписка' }, { status: 409 })
  }

  // ── Даунгрейд без списания (сейчас / со следующего периода) ───────────────
  if (plan.kind === 'downgrade') {
    if (mode === 'now') {
      const newUntil = new Date(now.getTime() + plan.nowExtraDays * DAY_MS)
      await payload.update({
        collection: 'subscribers',
        id: (sub as any).id,
        data: {
          activeTier: Number(tier.id),
          subscriptionUntil: newUntil.toISOString(),
          pendingTier: null,
        } as any,
        overrideAccess: true,
      })
      return NextResponse.json({ switched: true, until: newUntil.toISOString(), tierName: tier.name })
    }
    // mode === 'next' — планируем смену на следующее продление.
    await payload.update({
      collection: 'subscribers',
      id: (sub as any).id,
      data: { pendingTier: Number(tier.id) } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ scheduled: true, until: until ? until.toISOString() : null, tierName: tier.name })
  }

  // ── Оплата: initial (полная цена) или upgrade (доплата за остаток) ────────
  const creds = credsFromSettings(settings)
  if (!creds) return NextResponse.json({ error: 'Приём платежей пока не настроен автором' }, { status: 503 })

  const isUpgrade = plan.kind === 'upgrade'
  const chargeRub = isUpgrade ? plan.amountRub : amountRub

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  const returnUrl = `https://${host}/account/subscription?paid=1`
  const description = (isUpgrade
    ? `Повышение уровня до «${tier.name}» — ${tenant.name}`
    : `Подписка «${tier.name}» — ${tenant.name}`).slice(0, 128)

  const receipt = buildReceipt({
    email: (sub as any).email || null,
    phone: (sub as any).phone || null,
    description,
    amountRub: chargeRub,
    taxSystem: (settings as any)?.yookassaTaxSystem ?? null,
    vatCode: (settings as any)?.yookassaVatCode ?? null,
  })

  try {
    const pay = await createInitialPayment(creds, {
      amountRub: chargeRub,
      description,
      returnUrl,
      metadata: {
        tenantId: String(tenantId),
        subscriberId: String((sub as any).id),
        tierId: String(tier.id),
        kind: isUpgrade ? 'subscription_upgrade' : 'subscription_initial',
      },
      receipt,
    })

    await payload.create({
      collection: 'subscription-payments',
      data: {
        tenant: Number(tenantId),
        subscriber: (sub as any).id,
        tier: tier.id,
        amountRub: chargeRub,
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
