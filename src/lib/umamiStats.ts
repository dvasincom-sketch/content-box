import {
  UMAMI_API_URL,
  UMAMI_API_TOKEN,
  UMAMI_API_USER,
  UMAMI_API_PASSWORD,
  umamiApiEnabled,
} from '@/lib/umami'

/**
 * Чтение агрегатов из self-hosted Umami (API v2) для раздела «Аналитика».
 * Один website Umami = один тенант (см. tenant.umamiWebsiteId). Всё серверное.
 *
 * Авторизация: готовый bearer-токен (UMAMI_API_TOKEN) ИЛИ логин/пароль
 * (UMAMI_API_USER/PASSWORD) → POST /auth/login, токен кэшируется в памяти
 * процесса с запасом до истечения. Любая ошибка сети/API → null (раздел
 * покажет заглушку, ничего не роняем).
 *
 * Эндпоинты Umami v2:
 *   GET /websites/:id/stats?startAt=&endAt=            — KPI с prev-периодом
 *   GET /websites/:id/pageviews?startAt=&endAt=&unit=  — ряд по дням
 *   GET /websites/:id/metrics?startAt=&endAt=&type=url — топ-страницы / referrer
 * startAt/endAt — эпоха в миллисекундах.
 */

export interface UmamiKpi {
  value: number
  prev: number
}
export interface UmamiPoint {
  day: string // YYYY-MM-DD
  pageviews: number
  visitors: number
}
export interface UmamiMetric {
  label: string
  count: number
}
export interface UmamiStats {
  range: number // дней
  pageviews: UmamiKpi
  visitors: UmamiKpi
  visits: UmamiKpi
  bounceRate: number // %, 0..100
  avgVisitSec: number // средняя длительность визита, сек
  series: UmamiPoint[]
  topPages: UmamiMetric[]
  topReferrers: UmamiMetric[]
}

// --- авторизация -----------------------------------------------------------
let cachedToken: { value: string; exp: number } | null = null

async function getToken(): Promise<string | null> {
  if (UMAMI_API_TOKEN) return UMAMI_API_TOKEN
  if (!UMAMI_API_USER || !UMAMI_API_PASSWORD) return null
  const now = Date.now()
  if (cachedToken && cachedToken.exp > now + 30_000) return cachedToken.value
  try {
    const res = await fetch(`${UMAMI_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: UMAMI_API_USER, password: UMAMI_API_PASSWORD }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { token?: string }
    if (!data.token) return null
    // Токен Umami живёт долго; перезапрашиваем раз в час на всякий случай.
    cachedToken = { value: data.token, exp: now + 60 * 60_000 }
    return data.token
  } catch {
    return null
  }
}

async function apiGet<T>(path: string, params: Record<string, string | number>): Promise<T | null> {
  const token = await getToken()
  if (!token) return null
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v))
  try {
    const res = await fetch(`${UMAMI_API_URL}${path}?${qs.toString()}`, {
      headers: {
        authorization: `Bearer ${token}`,
        // Umami Cloud / API-ключи используют этот заголовок; для self-hosted
        // с bearer он просто игнорируется — безопасно слать оба.
        'x-umami-api-key': token,
      },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

// --- нормализация ----------------------------------------------------------
type StatsRaw = Record<string, { value?: number; prev?: number } | number | undefined>
type SeriesRaw = { pageviews?: Array<{ x: string; y: number }>; sessions?: Array<{ x: string; y: number }> }
type MetricRaw = Array<{ x: string | null; y: number }>

function kpi(raw: StatsRaw, key: string): UmamiKpi {
  const v = raw?.[key]
  if (v && typeof v === 'object') return { value: Number(v.value) || 0, prev: Number(v.prev) || 0 }
  return { value: Number(v) || 0, prev: 0 }
}

function dayKey(x: string): string {
  // Umami отдаёт 'YYYY-MM-DD HH:00:00' (или ISO). Берём дату.
  return x.slice(0, 10)
}

/** Основная точка входа. Возвращает агрегаты по website за `days` дней или null. */
export async function getUmamiStats(
  websiteId: string,
  days: number,
  timezone = 'Europe/Moscow',
): Promise<UmamiStats | null> {
  if (!umamiApiEnabled() || !websiteId) return null
  const endAt = Date.now()
  const startAt = endAt - days * 24 * 60 * 60 * 1000
  const base = { startAt, endAt }

  const [stats, series, pages, refs] = await Promise.all([
    apiGet<StatsRaw>(`/websites/${websiteId}/stats`, base),
    apiGet<SeriesRaw>(`/websites/${websiteId}/pageviews`, { ...base, unit: 'day', timezone }),
    apiGet<MetricRaw>(`/websites/${websiteId}/metrics`, { ...base, type: 'url', limit: 8 }),
    apiGet<MetricRaw>(`/websites/${websiteId}/metrics`, { ...base, type: 'referrer', limit: 8 }),
  ])
  if (!stats) return null

  const pageviews = kpi(stats, 'pageviews')
  const visitors = kpi(stats, 'visitors')
  const visits = kpi(stats, 'visits')
  const bounces = kpi(stats, 'bounces')
  const totaltime = kpi(stats, 'totaltime') // сумма секунд

  // Ряд по дням: сшиваем pageviews + sessions(=посетители по дню) по дате.
  const pvByDay = new Map<string, number>()
  for (const p of series?.pageviews ?? []) pvByDay.set(dayKey(p.x), (pvByDay.get(dayKey(p.x)) || 0) + Number(p.y || 0))
  const visByDay = new Map<string, number>()
  for (const s of series?.sessions ?? []) visByDay.set(dayKey(s.x), (visByDay.get(dayKey(s.x)) || 0) + Number(s.y || 0))
  const dayset = new Set<string>([...pvByDay.keys(), ...visByDay.keys()])
  const seriesOut: UmamiPoint[] = [...dayset]
    .sort()
    .map((day) => ({ day, pageviews: pvByDay.get(day) || 0, visitors: visByDay.get(day) || 0 }))

  const toMetric = (raw: MetricRaw | null): UmamiMetric[] =>
    (raw ?? [])
      .filter((r) => r && r.y > 0)
      .map((r) => ({ label: (r.x ?? '').trim() || '(прямой)', count: Number(r.y) || 0 }))

  return {
    range: days,
    pageviews,
    visitors,
    visits,
    bounceRate: visits.value > 0 ? Math.round((bounces.value / visits.value) * 100) : 0,
    avgVisitSec: visits.value > 0 ? Math.round(totaltime.value / visits.value) : 0,
    series: seriesOut,
    topPages: toMetric(pages),
    topReferrers: toMetric(refs),
  }
}

/** Компактные KPI для дашборда (посетители+просмотры за N дней) или null. */
export async function getUmamiDashKpis(
  websiteId: string,
  days = 7,
): Promise<{ visitors: number; pageviews: number; days: number } | null> {
  if (!umamiApiEnabled() || !websiteId) return null
  const endAt = Date.now()
  const startAt = endAt - days * 24 * 60 * 60 * 1000
  const stats = await apiGet<StatsRaw>(`/websites/${websiteId}/stats`, { startAt, endAt })
  if (!stats) return null
  return { visitors: kpi(stats, 'visitors').value, pageviews: kpi(stats, 'pageviews').value, days }
}

// --- форматтеры ------------------------------------------------------------
export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0с'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return m > 0 ? `${m}м ${s}с` : `${s}с`
}

/** Дельта в % между value и prev (для стрелок KPI). null — если prev нулевой. */
export function deltaPct(k: UmamiKpi): number | null {
  if (!k.prev || k.prev <= 0) return null
  return Math.round(((k.value - k.prev) / k.prev) * 100)
}
