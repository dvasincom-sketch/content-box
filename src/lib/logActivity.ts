import type { Payload } from 'payload'

/** Тип действия в журнале студии. */
export type ActivityAction = 'login' | 'create' | 'update' | 'delete'

/** id связи независимо от depth (число/строка или populated-объект). */
function relId(v: unknown): number | null {
  if (v == null) return null
  const raw = typeof v === 'object' ? (v as { id?: unknown }).id : v
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/**
 * Запись события в журнал активности студии (`studio-activity`).
 * Пишется всегда с overrideAccess (коллекция закрыта на прямой create).
 * Никогда не бросает исключение — журнал не должен ломать основную операцию.
 */
export async function logActivity(
  payload: Payload,
  args: { tenant: unknown; user: unknown; action: ActivityAction; entity: string; title?: string },
): Promise<void> {
  const tenant = relId(args.tenant)
  const user = relId(args.user)
  if (!tenant || !user) return
  try {
    await payload.create({
      collection: 'studio-activity',
      data: {
        tenant,
        user,
        action: args.action,
        entity: args.entity,
        title: (args.title || '').slice(0, 200),
      },
      overrideAccess: true,
    } as any)
  } catch {
    /* игнорируем: журнал вторичен */
  }
}

/** Хук afterChange коллекции: логирует создание/изменение контента реальным пользователем. */
export function activityAfterChange(entity: string) {
  return async ({ doc, req, operation }: any) => {
    if (operation !== 'create' && operation !== 'update') return
    const user = req?.user
    if (!user?.id) return
    await logActivity(req.payload, {
      tenant: doc?.tenant ?? user.tenant,
      user: user.id,
      action: operation,
      entity,
      title: doc?.title || doc?.name || '',
    })
  }
}

/** Хук afterDelete коллекции: логирует удаление контента. */
export function activityAfterDelete(entity: string) {
  return async ({ doc, req }: any) => {
    const user = req?.user
    if (!user?.id) return
    await logActivity(req.payload, {
      tenant: doc?.tenant ?? user.tenant,
      user: user.id,
      action: 'delete',
      entity,
      title: doc?.title || doc?.name || '',
    })
  }
}
