import { NextResponse } from 'next/server'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { resolvePayContext } from '@/lib/payContext'

/**
 * Отмена подписки подписчиком = выключение автопродления. Доступ к контенту
 * сохраняется до конца оплаченного периода (subscriptionUntil). Реального
 * списания больше не будет — крон автосписаний берёт только autoRenew=true.
 *
 * Тенант — по ХОСТУ (на /api/* нет x-tenant-id), tenantId передаём в
 * getCurrentSubscriber, иначе он не увидит вошедшего.
 */
export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  const pc = await resolvePayContext(req)
  if (!pc) return NextResponse.json({ error: 'Тенант не определён' }, { status: 400 })
  const { payload, tenantId } = pc

  const sub = await getCurrentSubscriber(tenantId)
  if (!sub) return NextResponse.json({ error: 'Не авторизовано', needAuth: true }, { status: 401 })

  try {
    await payload.update({
      collection: 'subscribers',
      id: (sub as any).id,
      data: { autoRenew: false } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Не удалось отменить подписку' }, { status: 500 })
  }
}
