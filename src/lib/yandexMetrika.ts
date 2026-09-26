/**
 * Чтение агрегатов из Яндекс.Метрики (Stat API) — уникальные посетители сайта.
 *
 * Счётчик на сайте только ОТПРАВЛЯЕт данные в Метрику; чтобы показать их в нашем
 * дашборде, нужен доступ к API: OAuth-токен и id счётчика (оба — из env, секреты
 * не на фронте). Пока не заданы — no-op (дашборд просто не покажет блок трафика).
 *
 *   YANDEX_METRIKA_TOKEN   — OAuth-токен с доступом к статистике счётчика.
 *   YANDEX_METRIKA_COUNTER — id счётчика (напр. 112999430).
 *
 * Токен получают в Яндекс OAuth (https://oauth.yandex.ru) для приложения с правом
 * «Яндекс.Метрика — получение статистики».
 */
const TOKEN = (process.env.YANDEX_METRIKA_TOKEN || '').trim()
const COUNTER = (process.env.YANDEX_METRIKA_COUNTER || '').trim()

export function metrikaEnabled(): boolean {
  return TOKEN.length > 0 && COUNTER.length > 0
}

/** Уникальные посетители (ym:s:users) за последние `days` дней. null — нет данных. */
export async function getMetrikaVisitors(days: number): Promise<number | null> {
  if (!metrikaEnabled()) return null
  const params = new URLSearchParams({
    ids: COUNTER,
    metrics: 'ym:s:users',
    date1: `${days}daysAgo`,
    date2: 'today',
  })
  try {
    const res = await fetch(`https://api-metrika.yandex.net/stat/v1/data?${params.toString()}`, {
      headers: { Authorization: `OAuth ${TOKEN}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { totals?: number[] }
    const v = Array.isArray(data?.totals) ? data.totals[0] : undefined
    return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null
  } catch {
    return null
  }
}
