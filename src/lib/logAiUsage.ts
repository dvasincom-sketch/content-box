import type { Payload } from 'payload'

/** Три категории использования Аси в проекте. */
export type AiSurface = 'compose' | 'summary' | 'support'

/**
 * Оценка числа токенов по тексту. Ася сейчас не возвращает точный usage, поэтому
 * считаем грубо по длине (смешанный ru/en ≈ символы/3). События помечаются
 * estimated=true; когда Ася начнёт отдавать usage — писать точные и estimated=false.
 */
export function estimateTokens(...parts: (string | null | undefined)[]): number {
  const chars = parts.reduce((n, p) => n + (typeof p === 'string' ? p.length : 0), 0)
  return Math.max(0, Math.round(chars / 3))
}

function relId(v: unknown): number | null {
  if (v == null) return null
  const raw = typeof v === 'object' ? (v as { id?: unknown }).id : v
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/**
 * Запись события использования Аси в журнал `ai-usage` (overrideAccess, коллекция
 * закрыта на прямой create). Никогда не бросает — учёт вторичен и не должен
 * ломать основную операцию (генерацию/ответ).
 */
export async function logAiUsage(
  payload: Payload,
  a: {
    tenant: unknown
    surface: AiSurface
    action?: string
    tokensIn?: number
    tokensOut?: number
    estimated?: boolean
    ok?: boolean
    actorType?: string
    meta?: string
  },
  req?: unknown,
): Promise<void> {
  const tenant = relId(a.tenant)
  if (!tenant) return
  const tokensIn = Math.max(0, Math.round(a.tokensIn || 0))
  const tokensOut = Math.max(0, Math.round(a.tokensOut || 0))
  try {
    await payload.create({
      collection: 'ai-usage',
      data: {
        tenant,
        surface: a.surface,
        action: (a.action || '').slice(0, 60) || undefined,
        tokensIn,
        tokensOut,
        tokensTotal: tokensIn + tokensOut,
        estimated: a.estimated !== false,
        ok: a.ok !== false,
        actorType: (a.actorType || '').slice(0, 24) || undefined,
        meta: (a.meta || '').slice(0, 200) || undefined,
      },
      overrideAccess: true,
      ...(req ? { req } : {}),
    } as any)
  } catch {
    /* учёт вторичен — игнорируем ошибки записи */
  }
}
