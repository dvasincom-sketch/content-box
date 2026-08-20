import { htmlToLexical } from './lexical'

/**
 * Тело поста из внешнего API → Lexical richText (наш формат `description`).
 *
 * Не тащим тяжёлый markdown-парсер: конвертируем в тот упрощённый HTML-подмножество
 * (p / h2 / h3 / ul / ol / li + инлайн b/i/a), который уже понимает htmlToLexical —
 * он и собирает валидный Lexical. Так реиспользуем существующий и проверенный код,
 * и на страницу не попадает сырой HTML (XSS-безопасно).
 *
 * Поддержка: markdown — заголовки (#, ##, ###), маркированные и нумерованные
 * списки, жирный, курсив, ссылки [текст](url), инлайн-код; и plain (абзацы по
 * пустой строке).
 */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function mdInline(s: string): string {
  let out = esc(s)
  out = out.replace(/`([^`]+)`/g, '$1')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  out = out.replace(/__([^_]+)__/g, '<b>$1</b>')
  out = out.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<i>$2</i>')
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t: string, u: string) => `<a href="${esc(u)}">${t}</a>`)
  return out
}

function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []
  let para: string[] = []
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null

  const flushPara = () => {
    if (para.length) {
      blocks.push(`<p>${mdInline(para.join(' '))}</p>`)
      para = []
    }
  }
  const flushList = () => {
    if (list) {
      blocks.push(`<${list.tag}>${list.items.map((i) => `<li>${mdInline(i)}</li>`).join('')}</${list.tag}>`)
      list = null
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      flushPara()
      flushList()
      continue
    }
    if (/^#\s+/.test(line)) {
      flushPara(); flushList()
      blocks.push(`<h2>${mdInline(line.replace(/^#\s+/, ''))}</h2>`)
      continue
    }
    const h = /^(#{2,3})\s+(.+)$/.exec(line)
    if (h) {
      flushPara(); flushList()
      blocks.push(`<${h[1].length === 2 ? 'h2' : 'h3'}>${mdInline(h[2])}</${h[1].length === 2 ? 'h2' : 'h3'}>`)
      continue
    }
    const li = /^[-*]\s+(.+)$/.exec(line)
    if (li) {
      flushPara()
      if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] } }
      list.items.push(li[1])
      continue
    }
    const oli = /^\d+\.\s+(.+)$/.exec(line)
    if (oli) {
      flushPara()
      if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] } }
      list.items.push(oli[1])
      continue
    }
    flushList()
    para.push(line)
  }
  flushPara()
  flushList()
  return blocks.join('\n')
}

/** Текст поста → Lexical richText JSON. */
export function contentToLexical(text: string, format: 'markdown' | 'plain') {
  const t = String(text || '')
  if (format === 'markdown') return htmlToLexical(mdToHtml(t) || '<p></p>')
  const html = t
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, ' ')}</p>`)
    .join('')
  return htmlToLexical(html || '<p></p>')
}
