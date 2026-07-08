import React from 'react'
import { RichText as LexicalRichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

/**
 * Обёртка над официальным JSX-конвертером Lexical.
 * Принимает content из поля richText (Pages.content) и рендерит в HTML.
 * Класс rich-text навешивает базовую типографику (стили в styles.css).
 */
export function RichText({ data }: { data: SerializedEditorState | null | undefined }) {
  if (!data) return null
  return (
    <div className="rich-text" style={{ color: 'var(--brand-text)' }}>
      <LexicalRichText data={data} />
    </div>
  )
}
