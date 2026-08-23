/**
 * Клиент ЮKassa (Вариант 1: магазин у каждого автора). Все вызовы — с кредами
 * конкретного тенанта (shopId + секрет из site-settings). Карточные данные мы
 * не трогаем: пользователь вводит их на хостинговой странице ЮKassa.
 *
 * Первый платёж создаётся с save_payment_method:true → в вебхуке приходит
 * payment_method.id, который сохраняем у подписчика для автосписаний
 * (createRecurringPayment). Чек 54-ФЗ прикладываем к каждому платежу.
 */
const API = 'https://api.yookassa.ru/v3'

export type YkCreds = { shopId: string; secret: string }

export type YkReceipt = {
  customer: { email?: string; phone?: string }
  items: Array<{
    description: string
    quantity: string
    amount: { value: string; currency: 'RUB' }
    vat_code: number
    payment_mode: 'full_payment'
    payment_subject: 'service'
  }>
  tax_system_code?: number
}

export type YkPayment = {
  id: string
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'
  paid?: boolean
  amount?: { value: string; currency: string }
  confirmation?: { confirmation_url?: string }
  payment_method?: {
    id?: string
    saved?: boolean
    type?: string
    title?: string
    card?: { first6?: string; last4?: string; card_type?: string }
  }
  metadata?: Record<string, string>
}

function rub(amountRub: number): string {
  return (Math.round(Number(amountRub) * 100) / 100).toFixed(2)
}

function authHeader(creds: YkCreds): string {
  return 'Basic ' + Buffer.from(`${creds.shopId}:${creds.secret}`).toString('base64')
}

function uuid(): string {
  return globalThis.crypto.randomUUID()
}

async function yoo(
  creds: YkCreds,
  path: string,
  init: { method?: string; body?: unknown; idempotenceKey?: string },
): Promise<YkPayment> {
  const res = await fetch(`${API}${path}`, {
    method: init.method || 'GET',
    headers: {
      Authorization: authHeader(creds),
      'Content-Type': 'application/json',
      ...(init.idempotenceKey ? { 'Idempotence-Key': init.idempotenceKey } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as YkPayment & { description?: string }
  if (!res.ok) {
    const msg = (json as any)?.description || (json as any)?.code || `ЮKassa HTTP ${res.status}`
    throw new Error(String(msg))
  }
  return json
}

export function credsFromSettings(settings: any): YkCreds | null {
  const shopId = String(settings?.yookassaShopId || '').trim()
  const secret = String(settings?.yookassaSecret || '').trim()
  if (!shopId || !secret) return null
  return { shopId, secret }
}

/** Чек 54-ФЗ. Возвращает undefined, если нет ни email, ни телефона, ни СНО. */
export function buildReceipt(args: {
  email?: string | null
  phone?: string | null
  description: string
  amountRub: number
  taxSystem?: number | null
  vatCode?: number | null
}): YkReceipt | undefined {
  const email = (args.email || '').trim()
  const phone = (args.phone || '').trim()
  if (!email && !phone) return undefined
  if (!args.taxSystem) return undefined
  return {
    customer: { ...(email ? { email } : {}), ...(phone ? { phone } : {}) },
    items: [
      {
        description: args.description.slice(0, 128),
        quantity: '1.00',
        amount: { value: rub(args.amountRub), currency: 'RUB' },
        vat_code: Number(args.vatCode) || 1,
        payment_mode: 'full_payment',
        payment_subject: 'service',
      },
    ],
    tax_system_code: Number(args.taxSystem),
  }
}

/** Первый платёж: карта вводится на стороне ЮKassa, способ сохраняется. */
export async function createInitialPayment(
  creds: YkCreds,
  args: {
    amountRub: number
    description: string
    returnUrl: string
    metadata: Record<string, string>
    receipt?: YkReceipt
  },
): Promise<{ id: string; confirmationUrl: string | null; raw: YkPayment }> {
  const raw = await yoo(creds, '/payments', {
    method: 'POST',
    idempotenceKey: uuid(),
    body: {
      amount: { value: rub(args.amountRub), currency: 'RUB' },
      capture: true,
      save_payment_method: true,
      confirmation: { type: 'redirect', return_url: args.returnUrl },
      description: args.description.slice(0, 128),
      metadata: args.metadata,
      ...(args.receipt ? { receipt: args.receipt } : {}),
    },
  })
  return { id: raw.id, confirmationUrl: raw.confirmation?.confirmation_url || null, raw }
}

/** Автосписание по ранее сохранённому способу (без участия пользователя). */
export async function createRecurringPayment(
  creds: YkCreds,
  args: {
    amountRub: number
    description: string
    paymentMethodId: string
    metadata: Record<string, string>
    receipt?: YkReceipt
  },
): Promise<YkPayment> {
  return yoo(creds, '/payments', {
    method: 'POST',
    idempotenceKey: uuid(),
    body: {
      amount: { value: rub(args.amountRub), currency: 'RUB' },
      capture: true,
      payment_method_id: args.paymentMethodId,
      description: args.description.slice(0, 128),
      metadata: args.metadata,
      ...(args.receipt ? { receipt: args.receipt } : {}),
    },
  })
}

/** Верификация: не доверяем телу вебхука, перезапрашиваем платёж. */
export async function getPayment(creds: YkCreds, id: string): Promise<YkPayment> {
  return yoo(creds, `/payments/${encodeURIComponent(id)}`, {})
}

/** Маска карты для UI, напр. «MIR ****4567». */
export function cardLabelFrom(payment: YkPayment): string | null {
  const card = payment.payment_method?.card
  if (card?.last4) {
    const brand = (card.card_type || 'Карта').toUpperCase()
    return `${brand} ****${card.last4}`
  }
  return payment.payment_method?.title || null
}
