import type { Payload } from 'payload'

/** Минимальная форма пула node-postgres, которая нам нужна. */
export type PgPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>
}

/**
 * Прямой SQL к базе Payload — для агрегатов, которые Local API выражать не умеет.
 *
 * Зачем: Payload не даёт GROUP BY, поэтому счётчики комментариев и реакций
 * считались выгрузкой всех строк в память (`limit: 20000`, а для «Обсуждаемого»
 * — `limit: 50000` по ВСЕМ комментариям тенанта за всё время) с последующим
 * подсчётом в JS. На горячем пути главной это разъезжается линейно по мере
 * роста: пара тысяч комментариев — и каждый заход тянет сотни тысяч строк.
 *
 * Используем `pool` (node-postgres) от адаптера db-postgres, а НЕ drizzle:
 * `drizzle-orm` в package.json не объявлен, он приезжает транзитивно, и прямой
 * импорт из него — та самая незадекларированная зависимость, от которой в этом
 * репозитории уже избавлялись. У pool же есть только `query`, и этого хватает.
 *
 * ПАРАМЕТРЫ ТОЛЬКО ЧЕРЕЗ $1, $2 — никакой интерполяции в текст запроса.
 *
 * ВНИМАНИЕ на будущее: запрос идёт через пул НАПРЯМУЮ и берёт СВОЁ соединение,
 * то есть проходит мимо транзакций Payload. Сейчас это безопасно — оба
 * вызывающих читают данные при рендере, транзакции там нет. Но если такой
 * запрос понадобится внутри хука с `req.transactionID`, он не увидит
 * незакоммиченных изменений этой транзакции.
 */
export async function sqlRows<T = Record<string, unknown>>(
  payload: Payload,
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = (payload.db as unknown as { pool?: PgPool }).pool
  if (!pool?.query) {
    throw new Error('[sql] адаптер БД не отдаёт pool — прямой SQL недоступен')
  }
  const res = await pool.query(text, params)
  return (res?.rows ?? []) as T[]
}

/**
 * id → массив int для `= ANY($n::int[])`. Всё, что не целое число, отбрасываем.
 *
 * Осторожно с пустой строкой: `Number('')` — это 0, а `Number.isInteger(0)` —
 * true, поэтому наивная проверка превращала пропущенный id в запрос строки с
 * id = 0. Пробелы ведут себя так же. Поэтому сначала отсекаем пустые значения.
 */
export function toIntArray(ids: Array<string | number>): number[] {
  const out: number[] = []
  for (const id of ids) {
    if (id == null) continue
    if (typeof id === 'string' && id.trim() === '') continue
    const n = Number(id)
    if (Number.isInteger(n)) out.push(n)
  }
  return out
}
