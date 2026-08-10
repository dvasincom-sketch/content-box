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
/** Эндпоинт полировки глав. По умолчанию — сосед /summary (заменяем хвост на /chapters). */
const ASYA_CHAPTERS_URL = process.env.ASYA_CHAPTERS_URL || ASYA_URL.replace(/\/summary\/?$/, '/chapters')

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

export type Chapter = { start: number; title: string }

/** Один VTT-cue: время начала (сек) и текст. */
type Cue = { start: number; text: string }

function parseVttTs(x: string): number {
  const m = String(x).trim().match(/(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?/)
  if (!m) return NaN
  const h = m[1] ? Number(m[1]) : 0
  return h * 3600 + Number(m[2]) * 60 + Number(m[3]) + (m[4] ? Number(m[4].padEnd(3, '0')) / 1000 : 0)
}

/** VTT → массив реплик [{ start, text }] (для нарезки по главам). */
function parseVttCues(vtt: string): Cue[] {
  const lines = String(vtt).replace(/\r/g, '').split('\n')
  const cues: Cue[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('-->')) continue
    const start = parseVttTs(lines[i].split('-->')[0])
    let j = i + 1
    const txt: string[] = []
    while (j < lines.length && lines[j].trim() !== '') {
      if (!lines[j].includes('-->')) txt.push(lines[j].replace(/<[^>]+>/g, '').trim())
      j++
    }
    const text = txt.join(' ').replace(/\s+/g, ' ').trim()
    if (Number.isFinite(start) && text) cues.push({ start, text })
    i = j
  }
  return cues
}

/**
 * Собираем текст речи по каждой главе: реплики, попадающие в интервал
 * [chapter.start, nextChapter.start). Возвращаем сегменты в порядке глав.
 */
export function chapterSegments(vtt: string, chapters: Chapter[]): { start: number; text: string }[] {
  const cues = parseVttCues(vtt)
  const chs = [...chapters].sort((a, b) => a.start - b.start)
  return chs.map((ch, i) => {
    const from = ch.start
    const to = i + 1 < chs.length ? chs[i + 1].start : Number.POSITIVE_INFINITY
    const text = cues.filter((c) => c.start >= from - 0.001 && c.start < to).map((c) => c.text).join(' ').replace(/\s+/g, ' ').trim()
    return { start: ch.start, text }
  })
}

/**
 * Полировка заголовков глав через Асю. Отдаём сегменты (время + расшифровка),
 * получаем по одному заголовку на сегмент (тот же порядок). Пустой заголовок
 * от Аси означает «оставить старый» — решает вызывающая сторона.
 */
export async function polishChapters(args: {
  segments: { start: number; text: string }[]
  title?: string
  lang?: string
}): Promise<string[]> {
  if (!asyaEnabled()) throw new Error('ASYA_SUMMARY_KEY не задан')
  const res = await fetch(ASYA_CHAPTERS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ASYA_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ segments: args.segments, title: args.title, lang: args.lang }),
  })
  const j: any = await res.json().catch(() => null)
  if (!res.ok || !j?.ok) throw new Error(j?.error || `Ася: HTTP ${res.status}`)
  return Array.isArray(j.titles) ? j.titles.map((t: unknown) => String(t || '')) : []
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
