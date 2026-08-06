import type { Payload } from 'payload'

/** Тип действия в журнале студии. */
export type ActivityAction = 'login' | 'create' | 'update' | 'delete' | 'invite'

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
    const payload = req?.payload
    if (!payload) return
    // Действия в студии идут через серверные роуты с overrideAccess БЕЗ req.user,
    // поэтому актёра берём из req.user, а если его нет — из doc.owner (роуты
    // штампуют владельца при создании). Так лог наполняется и через кастомные роуты.
    // Апдейты без реального пользователя (автообновления статуса видео и т.п.)
    // не логируем — иначе лента засоряется служебными правками.
    if (operation === 'update' && !req?.user?.id) return
    const actor = relId(req?.user?.id) ?? relId(doc?.owner)
    const tenant = relId(doc?.tenant) ?? relId(req?.user?.tenant)
    if (!actor || !tenant) return
    await logActivity(payload, {
      tenant,
      user: actor,
      action: operation,
      entity,
      title: doc?.title || doc?.name || '',
    })
  }
}

/** Хук afterDelete коллекции: логирует удаление контента. */
export function activityAfterDelete(entity: string) {
  return async ({ doc, req }: any) => {
    const payload = req?.payload
    if (!payload) return
    const actor = relId(req?.user?.id) ?? relId(doc?.owner)
    const tenant = relId(doc?.tenant) ?? relId(req?.user?.tenant)
    if (!actor || !tenant) return
    await logActivity(payload, {
      tenant,
      user: actor,
      action: 'delete',
      entity,
      title: doc?.title || doc?.name || '',
    })
  }
}
