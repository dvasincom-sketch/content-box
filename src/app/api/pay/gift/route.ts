import { NextResponse } from 'next/server'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { resolvePayContext } from '@/lib/payContext'
import { credsFromSettings, buildReceipt, createOneTimePayment } from '@/lib/yookassa'
import { sqlRows } from '@/lib/sql'

/**
 * Покупка подарочной подписки (один получатель). Покупатель платит за N месяцев
 * уровня. Создаём РАЗОВЫЙ платёж ЮKassa и промокод gift_codes(pending); после
 * оплаты вебхук активирует код и шлёт письмо получателю.
 *
 * Тенант — по ХОСТУ (на /api/* нет x-tenant-id), tenantId передаём в
 * getCurrentSubscriber, иначе он не увидит вошедшего.
 *
 * Body: { tierId, months, recipientEmail, buyerName? }
 * Ответ: { confirmationUrl } | { error }
 */
export const runtime = 'nodejs'

const MONTHS_ALLOWED = [1, 3, 6, 12]

export async function POST(req: Request): Promise<Response> {
  const pc = await resolvePayContext(req)
  if (!pc) return NextResponse.json({ error: 'Тенант не определён' }, { status: 400 })
  const { payload, tenantId, tenant, settings } = pc

  const creds = credsFromSettings(settings)
  if (!creds) return NextResponse.json({ error: 'Приём платежей пока не настроен автором' }, { status: 503 })

  let body: any = {}
  try { body = await req.json() } catch { /* пусто */ }
  const months = Number(body?.months)
  if (!MONTHS_ALLOWED.includes(months)) return NextResponse.json({ error: 'Некорректный период' }, { status: 400 })
  const recipientEmail = String(body?.recipientEmail || '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) return NextResponse.json({ error: 'Укажите корректный e-mail получателя' }, { status: 400 })
  if (!body?.tierId) return NextResponse.json({ error: 'Не выбран уровень' }, { status: 400 })

  const tier: any = await payload.findByID({ collection: 'subscription-tiers', id: body.tierId, depth: 0, overrideAccess: true }).catch(() => null)
  const tTenant = tier && (typeof tier.tenant === 'object' ? tier.tenant?.id : tier.tenant)
  if (!tier || String(tTenant) !== String(tenantId) || tier.isActive === false) {
    return NextResponse.json({ error: 'Уровень подписки не найден' }, { status: 404 })
  }
  const amountRub = Number(tier.priceRub || 0) * months
  if (!(amountRub > 0)) return NextResponse.json({ error: 'Некорректная цена' }, { status: 400 })

  const sub = await getCurrentSubscriber(tenantId).catch(() => null)
  const buyerName = String(body?.buyerName || (sub as any)?.displayName || '').trim().slice(0, 80)

  // Уникальный код (несколько попыток на случай коллизии).
  let code = ''
  let giftId: number | null = null
  for (let attempt = 0; attempt < 5 && giftId == null; attempt++) {
    code = genCode()
    try {
      const rows = await sqlRows<{ id: number }>(
        payload,
        `INSERT INTO gift_codes (tenant_id, code, tier_id, months, amount_rub, status, recipient_email, buyer_name)
         VALUES ($1,$2,$3,$4,$5,'pending',$6,$7) RETURNING id`,
        [Number(tenantId), code, tier.id, months, amountRub, recipientEmail, buyerName || null],
      )
      giftId = rows[0]?.id ?? null
    } catch { /* коллизия кода — пробуем ещё */ }
  }
  if (giftId == null) return NextResponse.json({ error: 'Не удалось создать промокод' }, { status: 500 })

  const description = `Подарочная подписка «${tier.name}» ${months} мес — ${tenant.name}`.slice(0, 128)
  const receipt = buildReceipt({
    // Чек нужен покупателю; если он гость без e-mail — используем e-mail получателя
    // (он обязателен и провалидирован), иначе магазин с фискализацией отклонит платёж.
    email: (sub as any)?.email || recipientEmail || null,
    phone: (sub as any)?.phone || null,
    description,
    amountRub,
    taxSystem: (settings as any)?.yookassaTaxSystem ?? null,
    vatCode: (settings as any)?.yookassaVatCode ?? null,
  })

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  const returnUrl = `https://${host}/gift?done=1`

  try {
    const pay = await createOneTimePayment(creds, {
      amountRub,
      description,
      returnUrl,
      metadata: { kind: 'gift', tenantId: String(tenantId), giftCodeId: String(giftId) },
      receipt,
    })
    await sqlRows(payload, `UPDATE gift_codes SET yookassa_payment_id=$2, updated_at=now() WHERE id=$1`, [giftId, pay.id]).catch(() => {})
    if (!pay.confirmationUrl) return NextResponse.json({ error: 'ЮKassa не вернула ссылку на оплату' }, { status: 502 })
    return NextResponse.json({ confirmationUrl: pay.confirmationUrl })
  } catch (e: any) {
    return NextResponse.json({ error: `Не удалось создать платёж: ${e?.message || e}` }, { status: 502 })
  }
}

/** Код вида GIFT-XXXXXXXX (без похожих символов). */
function genCode(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 8; i++) s += abc[Math.floor(Math.random() * abc.length)]
  return `GIFT-${s}`
}
