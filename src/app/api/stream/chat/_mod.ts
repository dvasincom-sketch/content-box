import { getCurrentAuthor } from '@/lib/currentAuthor'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'

/**
 * Список email-модераторов из поля трансляции (JSON-массив или строка с
 * разделителями) → нормализованный, в нижнем регистре, без дублей.
 */
export function normModEmails(v: unknown): string[] {
  const arr = Array.isArray(v)
    ? v
    : typeof v === 'string'
      ? v.split(/[\n,;]+/)
      : []
  return Array.from(new Set(arr.map((x) => String(x ?? '').trim().toLowerCase()).filter(Boolean)))
}

export type ModCtx = { canModerate: boolean; owner: boolean; subscriberId: number | null }

/** JSON-массив id → массив чисел (без дублей, без мусора). */
export function normModIds(v: unknown): number[] {
  const arr = Array.isArray(v) ? v : []
  return Array.from(new Set(arr.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)))
}

/**
 * Может ли текущий пользователь модерировать чат.
 * Да, если это владелец студии (author, не contributor) ИЛИ подписчик, который
 * назначен модератором — по id (сквозной список модераторов тенанта) либо по
 * email в списке конкретной трансляции (stream.moderatorEmails, legacy).
 */
export async function moderatorFor(tenantId: string, stream: any, globalModIds: unknown = []): Promise<ModCtx> {
  const author = await getCurrentAuthor().catch(() => null)
  const isOwner = Boolean(
    author &&
      Number(author.tenantId) === Number(tenantId) &&
      (author.user as { tenantRole?: string | null })?.tenantRole !== 'contributor',
  )
  if (isOwner) return { canModerate: true, owner: true, subscriberId: null }

  const ids = normModIds(globalModIds)
  const emails = normModEmails(stream?.moderatorEmails)
  if (ids.length || emails.length) {
    const sub = await getCurrentSubscriber(tenantId).catch(() => null)
    if (sub) {
      const sid = Number((sub as any).id)
      const email = String((sub as any).email || '').trim().toLowerCase()
      if (ids.includes(sid) || (email && emails.includes(email))) {
        return { canModerate: true, owner: false, subscriberId: sid }
      }
    }
  }
  return { canModerate: false, owner: false, subscriberId: null }
}
