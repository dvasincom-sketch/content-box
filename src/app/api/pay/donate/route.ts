import { NextResponse } from 'next/server'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { resolvePayContext } from '@/lib/payContext'
import { credsFromSettings, buildReceipt, createOneTimePayment } from '@/lib/yookassa'

/**
 * Разовая поддержка проекта («Поддержать»). Гость или подписчик указывает сумму
 * (+ цель/сообщение/аноним). Создаём РАЗОВЫЙ платёж ЮKassa (карта не сохраняется),
 * пишем support-payments(pending), редирект на ЮKassa. Успех подтверждает вебхук.
 *
 * Тенант — по ХОСТУ (на /api/* нет x-tenant-id), tenantId передаём в
 * getCurrentSubscriber, иначе он не увидит вошедшего.
 *
 * Body: { amountRub, goalId?, message?, isAnonymous?, name?, email? }
 * Ответ: { confirmationUrl } | { error }
 */
export const runtime = 'nodejs'

const MAX_RUB = 500000

export async function POST(req: Request): Promise<Response> {
  const pc = await resolvePayContext(req)
  if (!pc) return NextResponse.json({ error: 'Тенант не определён' }, { status: 400 })
  const { payload, tenantId, tenant, settings } = pc

  const creds = credsFromSettings(settings)
  if (!creds) return NextResponse.json({ error: 'Приём платежей пока не настроен автором' }, { status: 503 })

  let body: any = {}
  try { body = await req.json() } catch { /* пусто */ }
  const amountRub = Math.floor(Number(body?.amountRub) || 0)
  if (!(amountRub > 0)) return NextResponse.json({ error: 'Укажите сумму' }, { status: 400 })
  if (amountRub > MAX_RUB) return NextResponse.json({ error: 'Слишком большая сумма' }, { status: 400 })

  const sub = await getCurrentSubscriber(tenantId).catch(() => null)

  // Цель (необязательно): должна принадлежать тенанту и быть активной.
  let goalId: number | null = null
  if (body?.goalId) {
    const g: any = await payload.findByID({ collection: 'support-goals', id: body.goalId, depth: 0, overrideAccess: true }).catch(() => null)
    const gTenant = g && (typeof g.tenant === 'object' ? g.tenant?.id : g.tenant)
    if (g && String(gTenant) === String(tenantId)) goalId = Number(g.id)
  }

  const isAnonymous = Boolean(body?.isAnonymous)
  const displayName = isAnonymous
    ? 'Аноним'
    : String(body?.name || (sub as any)?.displayName || '').trim().slice(0, 80) || 'Гость'
  const message = String(body?.message || '').trim().slice(0, 1000)

  // Запись поддержки (pending) — витрина считает только succeeded.
  let supportPaymentId: string | number | null = null
  try {
    const sp = await payload.create({
      collection: 'support-payments',
      data: {
        tenant: Number(tenantId),
        ...(goalId ? { goal: goalId } : {}),
        displayName,
        amountRub,
        message: message || undefined,
        isAnonymous,
        status: 'pending',
      } as any,
      overrideAccess: true,
    })
    supportPaymentId = sp?.id ?? null
  } catch { /* без записи не критично — всё равно проведём платёж */ }

  const email = String(body?.email || (sub as any)?.email || '').trim()
  const description = `Поддержка проекта — ${tenant.name}`.slice(0, 128)
  const receipt = buildReceipt({
    email: email || null,
    phone: (sub as any)?.phone || null,
    description,
    amountRub,
    taxSystem: (settings as any)?.yookassaTaxSystem ?? null,
    vatCode: (settings as any)?.yookassaVatCode ?? null,
  })

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  const returnUrl = `https://${host}/donate?thanks=1`

  try {
    const pay = await createOneTimePayment(creds, {
      amountRub,
      description,
      returnUrl,
      metadata: {
        kind: 'donate',
        tenantId: String(tenantId),
        ...(supportPaymentId != null ? { supportPaymentId: String(supportPaymentId) } : {}),
      },
      receipt,
    })
    if (!pay.confirmationUrl) return NextResponse.json({ error: 'ЮKassa не вернула ссылку на оплату' }, { status: 502 })
    return NextResponse.json({ confirmationUrl: pay.confirmationUrl })
  } catch (e: any) {
    return NextResponse.json({ error: `Не удалось создать платёж: ${e?.message || e}` }, { status: 502 })
  }
}
