/**
 * Извлекает связный простой текст из Lexical richText-значения.
 *
 * Используется для авто-генерации SEO-описаний из поля `description`
 * и для проверки «пустоты» richText (пустой richText = root с пустым
 * параграфом, а не null — поэтому naive-проверка на null не годится).
 *
 * Рекурсивно обходит дерево, собирая все текстовые узлы. Между блочными
 * узлами (параграфы, заголовки, элементы списка) вставляет пробел,
 * чтобы слова из соседних блоков не слипались.
 */
type LexicalNode = {
  type?: string
  text?: string
  children?: LexicalNode[]
  [key: string]: unknown
}

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'listitem',
  'list',
  'quote',
  'horizontalrule',
])

function walk(node: LexicalNode | undefined, out: string[]): void {
  if (!node) return

  // Текстовый узел.
  if (typeof node.text === 'string' && node.text.length > 0) {
    out.push(node.text)
  }

  // Рекурсия по детям.
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walk(child, out)
    }
  }

  // После блочного узла — разделитель, чтобы слова не слипались.
  if (node.type && BLOCK_TYPES.has(node.type)) {
    out.push(' ')
  }
}

/**
 * Возвращает нормализованный простой текст (одиночные пробелы, обрезка краёв).
 * Для пустого/невалидного значения возвращает пустую строку.
 */
export function extractLexicalText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const root = (value as { root?: LexicalNode }).root
  if (!root) return ''
  const out: string[] = []
  walk(root, out)
  return out.join('').replace(/\s+/g, ' ').trim()
}

/**
 * true, если richText содержит хоть какой-то непробельный текст.
 */
export function hasLexicalText(value: unknown): boolean {
  return extractLexicalText(value).length > 0
}

/**
 * Обрезает строку до maxLen символов по границе слова (не рвёт слово посередине).
 * Если ближайшая граница слишком близко к началу, обрезает жёстко.
 */
export function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const slice = text.slice(0, maxLen)
  const lastSpace = slice.lastIndexOf(' ')
  // Если пробел найден и он не в самом начале — режем по нему.
  if (lastSpace > maxLen * 0.6) {
    return slice.slice(0, lastSpace).trimEnd()
  }
  return slice.trimEnd()
}

/**
 * Извлекает заголовки (heading-узлы) из Lexical richText с их уровнем.
 * Возвращает массив { level, text } в порядке появления.
 * level: 1 для h1, 2 для h2, ... (Lexical хранит tag как 'h2', 'h3').
 */
export function extractHeadings(value: unknown): { level: number; text: string }[] {
  if (!value || typeof value !== 'object') return []
  const root = (value as { root?: LexicalNode }).root
  if (!root) return []

  const headings: { level: number; text: string }[] = []

  function collectText(node: LexicalNode, out: string[]): void {
    if (typeof node.text === 'string') out.push(node.text)
    if (Array.isArray(node.children)) {
      for (const ch of node.children) collectText(ch, out)
    }
  }

  function walkHeadings(node: LexicalNode | undefined): void {
    if (!node) return
    if (node.type === 'heading') {
      const tag = typeof node.tag === 'string' ? node.tag : ''
      const level = /^h([1-6])$/.exec(tag)?.[1]
      const parts: string[] = []
      if (Array.isArray(node.children)) {
        for (const ch of node.children) collectText(ch, parts)
      }
      headings.push({
        level: level ? Number(level) : 2,
        text: parts.join('').trim(),
      })
    }
    if (Array.isArray(node.children)) {
      for (const ch of node.children) walkHeadings(ch)
    }
  }

  walkHeadings(root)
  return headings
}

/** Грубый подсчёт слов в тексте (для оценки «длины контента»). */
export function wordCount(text: string): number {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).length
}
