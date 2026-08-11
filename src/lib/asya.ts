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
  /** Доп. контекст видео (участники/тема) — помогает Асе точнее назвать людей. */
  context?: string
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
      context: args.context,
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

/**
 * VTT → реплики с таймкодами для построения глав, прорежённые в окна ~windowSec
 * секунд (склеиваем текст соседних cue в одно окно), чтобы уложиться в лимит
 * промпта на длинных видео. Возвращает [{ start, text }] по возрастанию времени.
 */
export function vttToCues(vtt: string, windowSec = 25, cap = 600): { start: number; text: string }[] {
  const cues = parseVttCues(vtt)
  if (!cues.length) return []
  const windows: { start: number; text: string }[] = []
  let curStart = cues[0].start
  let buf: string[] = []
  for (const c of cues) {
    if (buf.length && c.start - curStart >= windowSec) {
      windows.push({ start: Math.round(curStart), text: buf.join(' ').replace(/\s+/g, ' ').trim() })
      curStart = c.start
      buf = []
    }
    buf.push(c.text)
  }
  if (buf.length) windows.push({ start: Math.round(curStart), text: buf.join(' ').replace(/\s+/g, ' ').trim() })
  // Прореживаем, если окон всё ещё слишком много (равномерно).
  if (windows.length > cap) {
    const step = windows.length / cap
    return Array.from({ length: cap }, (_, k) => windows[Math.floor(k * step)])
  }
  return windows
}

/**
 * Построение глав «с нуля» через Асю: отдаём полную расшифровку с таймкодами,
 * Ася сама делит видео на осмысленные главы и возвращает [{ start, title }]
 * (границы по возрастанию, первая с 0).
 */
export async function buildChapters(args: {
  cues: { start: number; text: string }[]
  title?: string
  lang?: string
  context?: string
}): Promise<Chapter[]> {
  if (!asyaEnabled()) throw new Error('ASYA_SUMMARY_KEY не задан')
  const res = await fetch(ASYA_CHAPTERS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ASYA_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'build', cues: args.cues, title: args.title, lang: args.lang, context: args.context }),
  })
  const j: any = await res.json().catch(() => null)
  if (!res.ok || !j?.ok) throw new Error(j?.error || `Ася: HTTP ${res.status}`)
  return Array.isArray(j.chapters)
    ? j.chapters
        .map((c: any) => ({ start: Math.max(0, Math.floor(Number(c?.start) || 0)), title: String(c?.title || '').slice(0, 120) }))
        .filter((c: Chapter) => c.title)
    : []
}

/* -------------------------------------------------------------------------- */
/* Обратная связь и знание Аси (обучение из студии + контекст-память по видео)  */
/* -------------------------------------------------------------------------- */
const ASYA_BASE = ASYA_URL.replace(/\/summary\/?$/, '')
const ASYA_FEEDBACK_URL = process.env.ASYA_FEEDBACK_URL || `${ASYA_BASE}/feedback`
const ASYA_KNOWLEDGE_URL = process.env.ASYA_KNOWLEDGE_URL || `${ASYA_BASE}/knowledge/video`

/**
 * Отправить Асе правку саммари как обучающий пример (best-effort: ошибки не
 * ломают студийный поток). Ася хранит правку и подмешивает как few-shot.
 */
export async function sendCorrection(a: {
  source?: string
  title?: string
  url?: string
  before?: string
  after: string
  kind?: string
}): Promise<void> {
  if (!asyaEnabled()) return
  try {
    await fetch(ASYA_FEEDBACK_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ASYA_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(a),
    })
  } catch {
    /* обучение не критично */
  }
}

/**
 * Пополнить знание Аси по видео (саммари + главы с таймкодами) для ответов
 * «где посмотреть …». Best-effort.
 */
export async function pushVideoKnowledge(a: {
  source: string
  title?: string
  url?: string
  summary?: string
  chapters?: Chapter[]
}): Promise<void> {
  if (!asyaEnabled()) return
  try {
    await fetch(ASYA_KNOWLEDGE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ASYA_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: a.source, title: a.title, url: a.url, summary: a.summary, chapters: a.chapters }),
    })
  } catch {
    /* знание не критично */
  }
}

/** Эндпоинт вопрос-ответа по видео проекта (панель «Спросить Асю»). */
const ASYA_ASK_URL = process.env.ASYA_ASK_URL || `${ASYA_BASE}/ask`

/**
 * Спросить Асю по знанию проекта (сервер-к-серверу, ключ — секрет). Возвращает
 * ответ и найденные видео (для ссылок в панели).
 */
export async function askAsya(q: string): Promise<{ answer: string; matches: { title: string | null; url: string | null; source: string }[] }> {
  if (!asyaEnabled()) throw new Error('ASYA_SUMMARY_KEY не задан')
  const res = await fetch(ASYA_ASK_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ASYA_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q }),
  })
  const j: any = await res.json().catch(() => null)
  if (!res.ok || !j?.ok) throw new Error(j?.error || `Ася: HTTP ${res.status}`)
  return {
    answer: String(j.answer || ''),
    matches: Array.isArray(j.matches)
      ? j.matches.map((m: any) => ({ title: m?.title ?? null, url: m?.url ?? null, source: String(m?.source || '') }))
      : [],
  }
}
