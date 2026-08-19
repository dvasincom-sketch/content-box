/**
 * Listmonk admin API — серверный клиент (только студия, owner-only).
 * За флагом env: без LISTMONK_API_* всё деградирует до пустых данных, экран
 * показывает заглушку. Авторы Listmonk-креды не получают.
 *
 * Кампании-дайджесты тегируются `tenant:<id>` (+ `seg:<tier|free>`), поэтому
 * фильтрация по тенанту — по тегу.
 */
const BASE = (process.env.LISTMONK_API_URL || '').replace(/\/$/, '')
const USER = (process.env.LISTMONK_API_USER || '').trim()
const TOKEN = (process.env.LISTMONK_API_TOKEN || '').trim()

export function listmonkEnabled(): boolean {
  return Boolean(BASE && USER && TOKEN)
}

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${USER}:${TOKEN}`).toString('base64')
}

async function lm<T = unknown>(path: string): Promise<T | null> {
  if (!listmonkEnabled()) return null
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: authHeader(), Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export type DigestStat = {
  id: number
  subject: string
  createdAt: string
  sent: number
  views: number
  clicks: number
  segment: string
}

type LmCampaign = {
  id: number
  subject: string
  created_at: string
  sent?: number
  views?: number
  clicks?: number
  tags?: string[]
}

/** Тело одного выпуска (кампании) — чтобы владелец мог открыть письмо, которое
 *  ушло подписчикам. Проверяем, что кампания принадлежит этому тенанту (по тегу
 *  tenant:<id>) — иначе null, чтобы нельзя было подсмотреть чужой выпуск. */
export async function getTenantCampaignHtml(
  tenantId: string | number,
  campaignId: number | string,
): Promise<{ subject: string; body: string; createdAt: string } | null> {
  const idNum = Number(campaignId)
  if (!Number.isFinite(idNum) || idNum <= 0) return null
  const j = await lm<{ data?: LmCampaign & { body?: string } }>(`/api/campaigns/${idNum}`)
  const c = j?.data
  if (!c) return null
  const tag = `tenant:${tenantId}`
  if (!Array.isArray(c.tags) || !c.tags.includes(tag)) return null
  return { subject: c.subject || '', body: (c.body as string) || '', createdAt: c.created_at || '' }
}

/** Дайджесты (кампании) тенанта — свежие первыми. Пусто, если Listmonk не подключён. */
export async function getTenantDigests(tenantId: string | number): Promise<DigestStat[]> {
  const j = await lm<{ data?: { results?: LmCampaign[] } }>(
    '/api/campaigns?per_page=100&order=DESC&order_by=created_at',
  )
  const results = j?.data?.results ?? []
  const tag = `tenant:${tenantId}`
  return results
    .filter((c) => Array.isArray(c.tags) && c.tags.includes(tag))
    .map((c) => ({
      id: c.id,
      subject: c.subject,
      createdAt: c.created_at,
      sent: c.sent ?? 0,
      views: c.views ?? 0,
      clicks: c.clicks ?? 0,
      segment: (c.tags ?? []).find((t) => t.startsWith('seg:'))?.slice(4) ?? '',
    }))
}
