import type { Payload } from 'payload'

export type SubscriberAction =
  | 'login'
  | 'register'
  | 'view'
  | 'comment'
  | 'reaction'
  | 'bookmark'
  | 'follow'
  | 'subscribe'
  | 'unsubscribe'
  | 'subscription_change'

/** id связи независимо от depth (число/строка/объект). */
function relId(v: unknown): number | string | null {
  if (v == null) return null
  const raw = typeof v === 'object' ? (v as { id?: unknown }).id : v
  return raw == null ? null : (raw as number | string)
}

/**
 * Записать значимое действие зрителя в `subscriber-activity`.
 *
 * Никогда не бросает и НЕ ждёт результата у вызывающего — это аналитика, она не
 * должна ломать вход/комментарий/просмотр и не должна их подтормаживать. Вызывать
 * без await: `void logSubscriberActivity(...)`.
 */
export async function logSubscriberActivity(
  payload: Payload,
  args: {
    tenant: unknown
    subscriber: unknown
    action: SubscriberAction
    targetType?: string | null
    targetId?: string | number | null
    meta?: Record<string, unknown> | null
  },
): Promise<void> {
  try {
    const tenant = relId(args.tenant)
    const subscriber = relId(args.subscriber)
    if (!tenant || !subscriber) return
    await payload.create({
      collection: 'subscriber-activity',
      data: {
        tenant,
        subscriber,
        action: args.action,
        targetType: args.targetType ?? null,
        targetId: args.targetId != null ? String(args.targetId) : null,
        meta: args.meta ?? null,
      },
      overrideAccess: true,
      context: { skipSubscriptionEvent: true },
    } as any)
  } catch {
    /* аналитика вторична — молча игнорируем */
  }
}
