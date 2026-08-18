/**
 * Санитайз блоков от Аси (capability compose) → строгие PBlock для конструктора.
 * Никогда не доверяем структуре ответа LLM: берём только известные типы и поля,
 * чистим Markdown до поддерживаемого набора, режем длины, проставляем id.
 * Медиа/ссылочные блоки материализуем ПУСТЫМИ плейсхолдерами (без данных).
 */
import { blankBlock, type PBlock, type PBlockType } from '@/lib/profileBlocks'

const TEXT_TYPES = new Set<PBlockType>([
  'hero', 'facts', 'text', 'timeline', 'relations', 'awards',
  'factsList', 'columns', 'callout', 'divider',
])
const PLACEHOLDER_TYPES = new Set<PBlockType>(['gallery', 'videos', 'categoryRow', 'publications', 'button'])

let seq = 0
function bid(): string {
  seq = (seq + 1) % 1e6
  return 'ai' + Date.now().toString(36) + seq.toString(36) + Math.random().toString(36).slice(2, 6)
}

function str(v: unknown, max = 400): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

/** Плоский текст: без переносов и Markdown-разметки (для меток, значений, лейблов). */
function plain(v: unknown, max = 300): string {
  return str(v, max).replace(/\s+/g, ' ').replace(/[*_`#>[\]]/g, '').trim()
}

/** Markdown ограниченного набора: снимаем HTML, код-ограждения, цитаты, лишние заголовки. */
function md(v: unknown, max = 6000): string {
  let s = str(v, max)
  if (!s) return ''
  s = s.replace(/<\/?[a-z][^>]*>/gi, '')            // HTML-теги
  s = s.replace(/```+/g, '')                        // код-ограждения
  s = s.replace(/^\s{0,3}>+\s?/gm, '')              // цитаты
  s = s.replace(/^\s{0,3}#{3,}\s*/gm, '## ')        // заголовки ###+ → ##
  s = s.replace(/^\s{0,3}#\s+/gm, '## ')            // # → ##
  s = s.replace(/\n{3,}/g, '\n\n')                  // не больше одной пустой строки
  return s.trim()
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

/** Один сырой блок → PBlock или null (если пустой/невалидный). */
function one(raw: unknown): PBlock | null {
  const b = rec(raw)
  const type = b.type as PBlockType
  const id = bid()
  const title = plain(b.title, 120)
  const withTitle = <T extends object>(x: T): T & { title?: string } => (title ? { ...x, title } : x)

  if (PLACEHOLDER_TYPES.has(type)) {
    // Пустой плейсхолдер — автор наполнит сам. Сохраняем подсказку ИИ (_hint) и,
    // для кнопки, лейбл. _hint показывается в превью, что вставить.
    const base = blankBlock(type, id)
    const hint = plain(b.hint, 140)
    const hintPart = hint ? { _hint: hint } : {}
    if (type === 'button') {
      const label = plain(b.label, 80)
      return { ...base, ...(label ? { label } : {}), ...hintPart } as PBlock
    }
    return { ...withTitle(base), ...hintPart } as PBlock
  }

  if (!TEXT_TYPES.has(type)) return null

  switch (type) {
    case 'hero': {
      const eyebrow = plain(b.eyebrow, 120)
      const subtitle = plain(b.subtitle, 160)
      const lead = md(b.lead, 1200)
      if (!eyebrow && !subtitle && !lead) return null
      return { id, type, eyebrow, subtitle, lead } as PBlock
    }
    case 'facts': {
      const items = arr(b.items)
        .map((it) => { const r = rec(it); return { label: plain(r.label, 80), value: plain(r.value, 200) } })
        .filter((f) => f.label || f.value)
        .slice(0, 24)
      if (!items.length) return null
      return withTitle({ id, type, items }) as PBlock
    }
    case 'text': {
      const body = md(b.body, 8000)
      if (!body) return null
      return withTitle({ id, type, body }) as PBlock
    }
    case 'timeline': {
      const items = arr(b.items)
        .map((it) => { const r = rec(it); return { year: plain(r.year, 24), title: plain(r.title, 160), text: md(r.text, 1200) } })
        .filter((t) => t.year || t.title || t.text)
        .slice(0, 40)
      if (!items.length) return null
      return withTitle({ id, type, items }) as PBlock
    }
    case 'relations': {
      const items = arr(b.items)
        .map((it) => { const r = rec(it); return { name: plain(r.name, 160), text: md(r.text, 3000) } })
        .filter((x) => x.name || x.text)
        .slice(0, 30)
      if (!items.length) return null
      return withTitle({ id, type, items }) as PBlock
    }
    case 'awards': {
      const items = arr(b.items)
        .map((it) => { const r = rec(it); return { title: plain(r.title, 160), subtitle: plain(r.subtitle, 200) } })
        .filter((x) => x.title || x.subtitle)
        .slice(0, 30)
      if (!items.length) return null
      return withTitle({ id, type, items }) as PBlock
    }
    case 'factsList': {
      const items = arr(b.items).map((x) => plain(x, 300)).filter(Boolean).slice(0, 40)
      if (!items.length) return null
      return withTitle({ id, type, items }) as PBlock
    }
    case 'columns': {
      const cols = arr(b.cols)
        .map((it) => { const r = rec(it); return { title: plain(r.title, 120), body: md(r.body, 4000) } })
        .filter((c) => c.title || c.body)
        .slice(0, 3)
      if (!cols.length) return null
      return withTitle({ id, type, cols }) as PBlock
    }
    case 'callout': {
      const text = md(b.text, 1500)
      if (!text) return null
      const variant = b.variant === 'note' ? 'note' : 'quote'
      const author = plain(b.author, 120)
      return { id, type, variant, text, ...(author ? { author } : {}) } as PBlock
    }
    case 'divider': {
      const variant = b.variant === 'dots' ? 'dots' : b.variant === 'space' ? 'space' : 'line'
      return { id, type, variant } as PBlock
    }
    default:
      return null
  }
}

/** Массив сырых блоков → безопасные PBlock (пустые отброшены, максимум 40). */
export function sanitizeComposeBlocks(raw: unknown): PBlock[] {
  return arr(raw).map(one).filter((b): b is PBlock => b !== null).slice(0, 40)
}
