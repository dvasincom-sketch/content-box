import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'

/**
 * Отмена подписки подписчиком = выключение автопродления. Доступ к контенту
 * сохраняется до конца оплаченного периода (subscriptionUntil). Реального
 * списания больше не будет — крон автосписаний берёт только autoRenew=true.
 */
export const runtime = 'nodejs'

export async function POST() {
  const sub = await getCurrentSubscriber()
  if (!sub) return NextResponse.json({ error: 'Не авторизовано' }, { status: 401 })
  try {
    const payload = await getPayload({ config: await config })
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
