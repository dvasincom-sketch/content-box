/**
 * Payload 3 stores richText as Lexical JSON: { root: { children: [...] } }.
 * We index plain text, not markup — walk the node tree and collect text leaves.
 *
 * Robust to unknown block/inline node types: anything with a `text` string is
 * collected, and `children` are recursed regardless of node type.
 */

type LexicalNode = {
  type?: string
  text?: string
  children?: LexicalNode[]
  [key: string]: unknown
}

type LexicalValue = { root?: LexicalNode } | null | undefined

export function lexicalToPlainText(value: LexicalValue): string {
  if (!value || typeof value !== 'object' || !value.root) return ''
  const out: string[] = []
  walk(value.root, out)
  return out.join(' ').replace(/\s+/g, ' ').trim()
}

function walk(node: LexicalNode, out: string[]): void {
  if (!node) return
  if (typeof node.text === 'string' && node.text.length > 0) out.push(node.text)
  if (Array.isArray(node.children)) {
    for (const child of node.children) walk(child, out)
  }
}

/** A field may be a Lexical object or already a plain string. Normalize to text. */
export function toPlainText(value: unknown): string {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim()
  return lexicalToPlainText(value as LexicalValue)
}
