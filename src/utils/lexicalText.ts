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
