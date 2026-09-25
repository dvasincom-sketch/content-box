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

/**
 * Может ли текущий пользователь модерировать чат этой трансляции.
 * Да, если это владелец студии (author, не contributor) ИЛИ подписчик, чей
 * email указан в списке модераторов трансляции (stream.moderatorEmails).
 */
export async function moderatorFor(tenantId: string, stream: any): Promise<ModCtx> {
  const author = await getCurrentAuthor().catch(() => null)
  const isOwner = Boolean(
    author &&
      Number(author.tenantId) === Number(tenantId) &&
      (author.user as { tenantRole?: string | null })?.tenantRole !== 'contributor',
  )
  if (isOwner) return { canModerate: true, owner: true, subscriberId: null }

  const mods = normModEmails(stream?.moderatorEmails)
  if (mods.length) {
    const sub = await getCurrentSubscriber(tenantId).catch(() => null)
    const email = String((sub as any)?.email || '').trim().toLowerCase()
    if (sub && email && mods.includes(email)) {
      return { canModerate: true, owner: false, subscriberId: Number((sub as any).id) }
    }
  }
  return { canModerate: false, owner: false, subscriberId: null }
}
