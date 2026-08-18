/**
 * Клиент конструктора «Ася» (capability "compose"): сплошной текст → блоки
 * страницы. Ключ — секрет, дёргаем ТОЛЬКО сервер-к-серверу (никогда из браузера).
 * Многошаговый диалог: текст + история правок + прошлый вариант блоков.
 *
 * Env читаем ЛЕНИВО внутри функций (не на уровне модуля) — чтобы значение бралось
 * из рантайм-окружения контейнера, а не «замораживалось» при сборке Next.
 * Env: ASYA_COMPOSE_KEY (обязателен), ASYA_COMPOSE_URL (по умолчанию — сосед
 * саммари: /summary → /compose).
 */
function composeKey(): string {
  return (process.env.ASYA_COMPOSE_KEY || '').trim()
}

function composeUrl(): string {
  if (process.env.ASYA_COMPOSE_URL) return process.env.ASYA_COMPOSE_URL
  const base = (process.env.ASYA_SUMMARY_URL || 'https://xn--80a8a2b.online/api/summary').replace(/\/summary\/?$/, '')
  return `${base}/compose`
}

export function composeEnabled(): boolean {
  return composeKey().length > 0
}

/**
 * Проверка доступности эндпоинта Аси /compose (GET возвращает служебную инфу).
 * Нужна для диагностики: 200 → роут задеплоен, 404 → сервис Аси без нового роута.
 */
export async function pingCompose(): Promise<{ reachable: boolean; status: number; host: string }> {
  let host = ''
  try { host = new URL(composeUrl()).host } catch { /* ignore */ }
  try {
    const res = await fetch(composeUrl(), { method: 'GET' })
    return { reachable: res.ok, status: res.status, host }
  } catch {
    return { reachable: false, status: 0, host }
  }
}

export type ComposeMsg = { role: 'user' | 'assistant'; content: string }
/** Сырой блок от Аси (без id, поля произвольные) — санитайз на нашей стороне. */
export type RawBlock = { type: string; [k: string]: unknown }
export type ComposeSuggest = { title?: string; tags?: string[] }

/**
 * Разобрать текст на блоки. Возвращает заметку ассистента и сырые блоки
 * (валидацию/санитайз делает вызывающий роут перед отдачей в UI).
 */
export async function composePageBlocks(args: {
  text: string
  messages?: ComposeMsg[]
  blocks?: RawBlock[]
  existing?: { type: string; title: string }[]
  lang?: string
  /** Ключ тенанта (из студии). Если не задан — платформенный из env. */
  key?: string
}): Promise<{ note: string; blocks: RawBlock[]; suggest: ComposeSuggest | null }> {
  const key = (args.key || '').trim() || composeKey()
  if (!key) throw new Error('ASYA_COMPOSE_KEY не задан')
  const res = await fetch(composeUrl(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: args.text,
      messages: args.messages ?? [],
      blocks: args.blocks ?? [],
      existing: args.existing ?? [],
      lang: args.lang || 'ru',
    }),
  })
  const j: any = await res.json().catch(() => null)
  if (!res.ok || !j?.ok) {
    throw new Error(j?.error || `Ася: HTTP ${res.status}`)
  }
  return {
    note: String(j.note || ''),
    blocks: Array.isArray(j.blocks) ? (j.blocks as RawBlock[]) : [],
    suggest: j?.suggest && typeof j.suggest === 'object' ? (j.suggest as ComposeSuggest) : null,
  }
}
