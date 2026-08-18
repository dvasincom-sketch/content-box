/**
 * Клиент конструктора «Ася» (capability "compose"): сплошной текст → блоки
 * страницы. Ключ — секрет, дёргаем ТОЛЬКО сервер-к-серверу (никогда из браузера).
 * Многошаговый диалог: текст + история правок + прошлый вариант блоков.
 *
 * Env: ASYA_COMPOSE_KEY (обязателен), ASYA_COMPOSE_URL (по умолчанию — сосед
 * саммари: /summary → /compose).
 */
const ASYA_URL = process.env.ASYA_SUMMARY_URL || 'https://xn--80a8a2b.online/api/summary'
const ASYA_BASE = ASYA_URL.replace(/\/summary\/?$/, '')
const COMPOSE_URL = process.env.ASYA_COMPOSE_URL || `${ASYA_BASE}/compose`
const COMPOSE_KEY = process.env.ASYA_COMPOSE_KEY || ''

export function composeEnabled(): boolean {
  return COMPOSE_KEY.trim().length > 0
}

export type ComposeMsg = { role: 'user' | 'assistant'; content: string }
/** Сырой блок от Аси (без id, поля произвольные) — санитайз на нашей стороне. */
export type RawBlock = { type: string; [k: string]: unknown }

/**
 * Разобрать текст на блоки. Возвращает заметку ассистента и сырые блоки
 * (валидацию/санитайз делает вызывающий роут перед отдачей в UI).
 */
export async function composePageBlocks(args: {
  text: string
  messages?: ComposeMsg[]
  blocks?: RawBlock[]
  lang?: string
}): Promise<{ note: string; blocks: RawBlock[] }> {
  if (!composeEnabled()) throw new Error('ASYA_COMPOSE_KEY не задан')
  const res = await fetch(COMPOSE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${COMPOSE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: args.text,
      messages: args.messages ?? [],
      blocks: args.blocks ?? [],
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
  }
}
