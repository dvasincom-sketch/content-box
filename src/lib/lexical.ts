/**
 * Конвертация простого текста в Lexical-richText JSON, который принимает
 * поле `description` (lexicalEditor) Payload.
 *
 * Пустая строка разделяет абзацы. Каждый абзац → paragraph-node с одним
 * text-node. Формат минимальный, но структурно валидный для Lexical —
 * форматирование (жирный/курсив) добавим отдельным шагом позже.
 *
 * Обратная операция (lexicalToPlainText) нужна редактированию: вытащить текст
 * из существующего документа обратно в textarea.
 */

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
  format: '' | 'left' | 'center' | 'right' | 'justify'
  indent: number
  textFormat: number
  children: LexicalTextNode[]
}

export type LexicalRoot = {
  root: {
    type: 'root'
    version: number
    direction: 'ltr' | null
    format: ''
    indent: number
    children: LexicalParagraph[]
  }
}

function textNode(text: string): LexicalTextNode {
  return {
    type: 'text',
    text,
    detail: 0,
    format: 0,
    mode: 'normal',
    style: '',
    version: 1,
  }
}

function paragraph(children: LexicalTextNode[]): LexicalParagraph {
  return {
    type: 'paragraph',
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    children,
  }
}

/**
 * plainText → Lexical JSON. Абзацы разделяются пустой строкой (\n\n).
 * Одиночные переводы строки внутри абзаца сохраняются как отдельные text-node
 * с \n (Lexical рендерит их как мягкий перенос внутри параграфа).
 */
export function plainTextToLexical(input: string): LexicalRoot {
  const normalized = (input || '').replace(/\r\n/g, '\n').trim()

  const blocks = normalized.length ? normalized.split(/\n{2,}/) : ['']

  const paragraphs: LexicalParagraph[] = blocks.map((block) => {
    // мягкие переносы внутри абзаца
    const lines = block.split('\n')
    if (lines.length === 1) {
      return paragraph([textNode(lines[0])])
    }
    // склеиваем строки через \n в один текст-нод (Lexical допускает \n в тексте)
    return paragraph([textNode(lines.join('\n'))])
  })

  return {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      children: paragraphs.length ? paragraphs : [paragraph([textNode('')])],
    },
  }
}

/**
 * Lexical JSON → plainText. Для формы редактирования: вытащить текст обратно.
 * Толерантна к неожиданной структуре — что не распознали, пропускаем.
 */
export function lexicalToPlainText(doc: any): string {
  try {
    const children = doc?.root?.children
    if (!Array.isArray(children)) return ''
    const blocks: string[] = []
    for (const node of children) {
      if (node?.type === 'paragraph' && Array.isArray(node.children)) {
        const text = node.children
          .filter((c: any) => c?.type === 'text' && typeof c.text === 'string')
          .map((c: any) => c.text)
          .join('')
        blocks.push(text)
      }
    }
    return blocks.join('\n\n')
  } catch {
    return ''
  }
}
