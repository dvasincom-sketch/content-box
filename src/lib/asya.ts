/**
 * Клиент саммаризатора «Ася» (внешний проект). Транскрипт → краткое содержание.
 * Ключ — секрет, дёргаем ТОЛЬКО сервер-к-серверу (никогда из браузера). Ася сама
 * кэширует по хэшу транскрипта, но мы дополнительно кэшируем результат на видео,
 * чтобы вообще не ходить в API повторно.
 *
 * Env: ASYA_SUMMARY_KEY (обязателен), ASYA_SUMMARY_URL (по умолчанию прод-домен).
 */
const ASYA_URL = process.env.ASYA_SUMMARY_URL || 'https://xn--80a8a2b.online/api/summary'
const ASYA_KEY = process.env.ASYA_SUMMARY_KEY || ''

/** Мин. цена тарифа (₽) для доступа к саммари от Аси. Ниже — апселл. */
export const ASYA_MIN_TIER_PRICE = Number(process.env.ASYA_MIN_TIER_PRICE_RUB || 2000)

export function asyaEnabled(): boolean {
  return ASYA_KEY.trim().length > 0
}

export interface AsyaSummary {
  tldr: string
  points: string[]
  text: string
  hash: string
  lang: string
}

export async function summarizeTranscript(args: {
  transcript: string
  title?: string
  source?: string
  lang?: string
  refresh?: boolean
}): Promise<AsyaSummary> {
  if (!asyaEnabled()) throw new Error('ASYA_SUMMARY_KEY не задан')
  const res = await fetch(ASYA_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ASYA_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: args.transcript,
      title: args.title,
      source: args.source,
      lang: args.lang,
      refresh: args.refresh === true,
    }),
  })
  const j: any = await res.json().catch(() => null)
  if (!res.ok || !j?.ok) {
    throw new Error(j?.error || `Ася: HTTP ${res.status}`)
  }
  return {
    tldr: String(j.tldr || ''),
    points: Array.isArray(j.points) ? j.points.map((p: unknown) => String(p)) : [],
    text: String(j.summary || ''),
    hash: String(j.hash || ''),
    lang: String(args.lang || 'ru'),
  }
}

/** VTT-транскрипт → плоский текст (без WEBVTT/таймкодов/номеров/тегов). */
export function vttToPlainText(vtt: string): string {
  const lines = String(vtt).replace(/\r/g, '').split('\n')
  const out: string[] = []
  let prev = ''
  for (const raw of lines) {
    const t = raw.trim()
    if (!t || t === 'WEBVTT' || t.includes('-->') || /^\d+$/.test(t) || t.startsWith('NOTE')) continue
    const clean = t.replace(/<[^>]+>/g, '').trim()
    if (!clean || clean === prev) continue // дедуп подряд идущих повторов
    out.push(clean)
    prev = clean
  }
  return out.join(' ').replace(/\s+/g, ' ').trim()
}
