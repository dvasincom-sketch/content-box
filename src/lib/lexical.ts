/**
 * Конвертация между упрощённым HTML (из редактора студии) и Lexical richText JSON.
 *
 * Поддерживаем: параграфы, жирный, курсив, подчёркнутый, зачёркнутый,
 * маркированные и нумерованные списки. Этого достаточно для «пиши как в соцсети».
 *
 * Формат-биты Lexical для текст-ноды (поле `format`):
 *   bold=1, italic=2, strikethrough=4, underline=8, code=16
 * Комбинируются битовым ИЛИ (жирный+курсив = 3).
 *
 * Редактор студии (contentEditable) выдаёт HTML вида:
 *   <p>Текст <strong>жирный</strong> и <em>курсив</em></p>
 *   <ul><li>пункт</li></ul>
 * Мы парсим его в Lexical на сервере (htmlToLexical) и разворачиваем обратно
 * в HTML для редактирования (lexicalToHtml).
 *
 * ВАЖНО: парсинг HTML тут — простой и толерантный (регэкспы + мини-стейт),
 * без DOM. Он рассчитан на HTML, который генерит НАШ редактор, а не на
 * произвольный ввод. Неизвестные теги игнорируются, текст сохраняется.
 */

const FMT_BOLD = 1
const FMT_ITALIC = 2
const FMT_STRIKE = 4
const FMT_UNDERLINE = 8

type LexicalTextNode = {
  type: 'text'
  text: string
  detail: number
  format: number
  mode: 'normal'
  style: string
  version: number
}

type LexicalParagraph = {
  type: 'paragraph'
  version: number
  direction: 'ltr' | null
  format: ''
  indent: number
  textFormat: number
  children: LexicalTextNode[]
}

type LexicalListItem = {
  type: 'listitem'
  version: number
  value: number
  checked?: boolean
  indent: number
  format: ''
  direction: 'ltr' | null
  children: LexicalTextNode[]
}

type LexicalList = {
  type: 'list'
  version: number
  listType: 'bullet' | 'number'
  start: number
  tag: 'ul' | 'ol'
  indent: number
  format: ''
  direction: 'ltr' | null
  children: LexicalListItem[]
}

export type LexicalRoot = {
  root: {
    type: 'root'
    version: number
    direction: 'ltr' | null
    format: ''
    indent: number
    children: (LexicalParagraph | LexicalList)[]
  }
}

/* -------------------------------------------------------------------------- */
/* Утилиты                                                                     */
/* -------------------------------------------------------------------------- */

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function encodeEntities(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function textNode(text: string, format = 0): LexicalTextNode {
  return { type: 'text', text, detail: 0, format, mode: 'normal', style: '', version: 1 }
}

/**
 * Разбирает inline-HTML одного блока в массив текст-нод с формат-битами.
 * Понимает вложенность <strong>/<b>, <em>/<i>, <u>, <s>/<strike>/<del>.
 */
function parseInline(html: string): LexicalTextNode[] {
  const nodes: LexicalTextNode[] = []
  // стек активных форматов
  let fmt = 0
  const stack: number[] = []

  // разбиваем на токены: теги и текст
  const tokenRe = /<\/?(strong|b|em|i|u|s|strike|del|br)\s*\/?>/gi
  let lastIndex = 0
  let m: RegExpExecArray | null

  const pushText = (raw: string) => {
    if (!raw) return
    const text = decodeEntities(raw)
    if (text.length === 0) return
    nodes.push(textNode(text, fmt))
  }

  const bit = (tag: string): number => {
    const t = tag.toLowerCase()
    if (t === 'strong' || t === 'b') return FMT_BOLD
    if (t === 'em' || t === 'i') return FMT_ITALIC
    if (t === 'u') return FMT_UNDERLINE
    if (t === 's' || t === 'strike' || t === 'del') return FMT_STRIKE
    return 0
  }

  while ((m = tokenRe.exec(html)) !== null) {
    // текст до тега
    pushText(html.slice(lastIndex, m.index))
    lastIndex = tokenRe.lastIndex

    const full = m[0]
    const tag = m[1].toLowerCase()

    if (tag === 'br') {
      // мягкий перенос внутри абзаца → добавим \n к последней ноде или новую
      nodes.push(textNode('\n', fmt))
      continue
    }

    const isClose = full.startsWith('</')
    const b = bit(tag)
    if (b === 0) continue

    if (isClose) {
      // снять формат: убрать последний соответствующий из стека
      const idx = stack.lastIndexOf(b)
      if (idx !== -1) stack.splice(idx, 1)
      fmt = stack.reduce((acc, x) => acc | x, 0)
    } else {
      stack.push(b)
      fmt = fmt | b
    }
  }
  // хвост
  pushText(html.slice(lastIndex))

  // если пусто — одна пустая нода
  if (nodes.length === 0) nodes.push(textNode(''))
  return nodes
}

function paragraph(children: LexicalTextNode[]): LexicalParagraph {
  return {
    type: 'paragraph',
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    children: children.length ? children : [textNode('')],
  }
}

function listNode(tag: 'ul' | 'ol', items: LexicalTextNode[][]): LexicalList {
  return {
    type: 'list',
    version: 1,
    listType: tag === 'ul' ? 'bullet' : 'number',
    start: 1,
    tag,
    indent: 0,
    format: '',
    direction: 'ltr',
    children: items.map((children, i) => ({
      type: 'listitem',
      version: 1,
      value: i + 1,
      indent: 0,
      format: '',
      direction: 'ltr',
      children: children.length ? children : [textNode('')],
    })),
  }
}

/* -------------------------------------------------------------------------- */
/* HTML → Lexical                                                              */
/* -------------------------------------------------------------------------- */

export function htmlToLexical(html: string): LexicalRoot {
  const src = (html || '').trim()
  const children: (LexicalParagraph | LexicalList)[] = []

  if (!src) {
    return rootOf([paragraph([textNode('')])])
  }

  // Разбиваем на блоки верхнего уровня: <p>…</p>, <ul>…</ul>, <ol>…</ol>
  const blockRe = /<(p|ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi
  let m: RegExpExecArray | null
  let matchedAny = false

  while ((m = blockRe.exec(src)) !== null) {
    matchedAny = true
    const tag = m[1].toLowerCase()
    const inner = m[2]

    if (tag === 'p') {
      children.push(paragraph(parseInline(inner)))
    } else {
      // список: вытащить <li>…</li>
      const items: LexicalTextNode[][] = []
      const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi
      let li: RegExpExecArray | null
      while ((li = liRe.exec(inner)) !== null) {
        items.push(parseInline(li[1]))
      }
      if (items.length) children.push(listNode(tag as 'ul' | 'ol', items))
    }
  }

  // Фолбэк: если не нашли блоков (редактор дал голый текст) — один параграф
  if (!matchedAny) {
    // разбить по двойным переносам на абзацы
    const blocks = src.replace(/\r\n/g, '\n').split(/\n{2,}/)
    for (const b of blocks) {
      children.push(paragraph(parseInline(b)))
    }
  }

  return rootOf(children.length ? children : [paragraph([textNode('')])])
}

function rootOf(children: (LexicalParagraph | LexicalList)[]): LexicalRoot {
  return {
    root: { type: 'root', version: 1, direction: 'ltr', format: '', indent: 0, children },
  }
}

/* -------------------------------------------------------------------------- */
/* Lexical → HTML (для редактирования)                                         */
/* -------------------------------------------------------------------------- */

function inlineToHtml(children: any[]): string {
  let out = ''
  for (const node of children || []) {
    if (node?.type !== 'text' || typeof node.text !== 'string') continue
    let t = encodeEntities(node.text).replace(/\n/g, '<br>')
    const f = node.format || 0
    if (f & FMT_BOLD) t = `<strong>${t}</strong>`
    if (f & FMT_ITALIC) t = `<em>${t}</em>`
    if (f & FMT_UNDERLINE) t = `<u>${t}</u>`
    if (f & FMT_STRIKE) t = `<s>${t}</s>`
    out += t
  }
  return out
}

export function lexicalToHtml(doc: any): string {
  try {
    const children = doc?.root?.children
    if (!Array.isArray(children)) return ''
    const parts: string[] = []
    for (const node of children) {
      if (node?.type === 'paragraph') {
        parts.push(`<p>${inlineToHtml(node.children) || ''}</p>`)
      } else if (node?.type === 'list') {
        const tag = node.tag === 'ol' ? 'ol' : 'ul'
        const items = (node.children || [])
          .map((li: any) => `<li>${inlineToHtml(li.children)}</li>`)
          .join('')
        parts.push(`<${tag}>${items}</${tag}>`)
      }
    }
    return parts.join('')
  } catch {
    return ''
  }
}

/* -------------------------------------------------------------------------- */
/* Совместимость: старые plain-хелперы (использовались до форматирования)       */
/* -------------------------------------------------------------------------- */

/** Оставлено для совместимости — оборачивает простой текст в один параграф. */
export function plainTextToLexical(input: string): LexicalRoot {
  const normalized = (input || '').replace(/\r\n/g, '\n').trim()
  const blocks = normalized.length ? normalized.split(/\n{2,}/) : ['']
  return rootOf(blocks.map((b) => paragraph([textNode(b)])))
}

/** Lexical → плоский текст (теряет форматирование). Для превью/фолбэков. */
export function lexicalToPlainText(doc: any): string {
  try {
    const children = doc?.root?.children
    if (!Array.isArray(children)) return ''
    const blocks: string[] = []
    for (const node of children) {
      if (node?.type === 'paragraph' && Array.isArray(node.children)) {
        blocks.push(node.children.filter((c: any) => c?.type === 'text').map((c: any) => c.text).join(''))
      } else if (node?.type === 'list' && Array.isArray(node.children)) {
        for (const li of node.children) {
          blocks.push(
            (li.children || []).filter((c: any) => c?.type === 'text').map((c: any) => c.text).join(''),
          )
        }
      }
    }
    return blocks.join('\n\n')
  } catch {
    return ''
  }
}
