import { NextResponse } from 'next/server'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { resolvePayContext } from '@/lib/payContext'
import { sqlRows } from '@/lib/sql'

/**
 * Активация подарочного промокода получателем (залогинен как подписчик).
 * Код должен быть 'active' и принадлежать этому тенанту. Продлеваем подписку
 * получателя на N месяцев уровня, помечаем код 'redeemed'.
 *
 * Тенант — по ХОСТУ (на /api/* нет x-tenant-id), tenantId передаём в
 * getCurrentSubscriber, иначе он не увидит вошедшего.
 *
 * Body: { code }
 */
export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  const pc = await resolvePayContext(req)
  if (!pc) return NextResponse.json({ error: 'Тенант не определён' }, { status: 400 })
  const { payload, tenantId } = pc

  const sub = await getCurrentSubscriber(tenantId)
  if (!sub) return NextResponse.json({ error: 'Войдите, чтобы активировать подарок', needAuth: true }, { status: 401 })

  let body: any = {}
  try { body = await req.json() } catch { /* пусто */ }
  const code = String(body?.code || '').trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'Введите промокод' }, { status: 400 })

  const rows = await sqlRows<any>(
    payload,
    `SELECT * FROM gift_codes WHERE code = $1 AND tenant_id = $2 LIMIT 1`,
    [code, Number(tenantId)],
  ).catch(() => [])
  const gift = rows[0]
  if (!gift) return NextResponse.json({ error: 'Промокод не найден' }, { status: 404 })
  if (gift.status === 'redeemed') return NextResponse.json({ error: 'Промокод уже активирован' }, { status: 409 })
  if (gift.status !== 'active') return NextResponse.json({ error: 'Промокод недействителен' }, { status: 409 })

  const tier: any = await payload.findByID({ collection: 'subscription-tiers', id: gift.tier_id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!tier) return NextResponse.json({ error: 'Уровень подписки не найден' }, { status: 404 })

  const months = Number(gift.months) || 1
  const now = new Date()
  const cur = (sub as any).subscriptionUntil ? new Date((sub as any).subscriptionUntil) : null
  const base = cur && cur > now ? cur : now
  const until = new Date(base)
  until.setMonth(until.getMonth() + months)

  try {
    await payload.update({
      collection: 'subscribers',
      id: (sub as any).id,
      data: {
        activeTier: Number(gift.tier_id),
        subscriptionUntil: until.toISOString(),
        ...((sub as any).subscriptionSince ? {} : { subscriptionSince: now.toISOString() }),
      } as any,
      overrideAccess: true,
    })
    await sqlRows(payload, `UPDATE gift_codes SET status='redeemed', redeemed_by=$2, redeemed_at=now(), updated_at=now() WHERE id=$1`, [gift.id, Number((sub as any).id)])
    return NextResponse.json({ ok: true, tierName: tier.name, months, until: until.toISOString() })
  } catch (e: any) {
    return NextResponse.json({ error: `Не удалось активировать: ${e?.message || e}` }, { status: 500 })
  }
}
