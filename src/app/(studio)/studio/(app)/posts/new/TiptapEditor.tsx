'use client'

import React, { useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Placeholder } from '@tiptap/extensions'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Pilcrow,
  ImagePlus,
  Loader2,
} from 'lucide-react'

/**
 * Редактор публикаций/страниц/категорий на Tiptap (ProseMirror).
 *
 * Тот же контракт, что у старого RichEditor: наружу отдаёт HTML (onChange),
 * который сервер конвертирует в Lexical (htmlToLexical); начальное значение —
 * HTML из lexicalToHtml. Поддержка: заголовки H2/H3, жирный, курсив,
 * подчёркнутый, зачёркнутый, списки, изображения (media/R2).
 *
 * Отличия от execCommand-редактора: нормальный undo/redo, устойчивое выделение,
 * чистая вставка (StarterKit сам нормализует), предсказуемая сериализация.
 *
 * Картинки — блочные ноды <img data-media-id>. На выходе onChange оборачиваем
 * их в <figure>, чтобы htmlToLexical материализовал upload-ноду Lexical (тот же
 * формат, что понимает публичный рендер Payload).
 *
 * Отключены расширения, которые наш HTML↔Lexical мост не сериализует
 * (цитаты, code-block, инлайн-код, горизонтальная линия, ссылки, H1/H4-H6),
 * чтобы редактирование было без потерь при сохранении.
 */

type Props = {
  initialHtml?: string
  onChange: (html: string) => void
  placeholder?: string
  uploadEndpoint?: string
}

// Расширяем Image, чтобы нода несла data-media-id (ключ медиа в R2).
const MediaImage = Image.extend({
  addAttributes() {
    return {
      ...(this.parent?.() || {}),
      mediaId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-media-id'),
        renderHTML: (attrs: Record<string, any>) =>
          attrs.mediaId ? { 'data-media-id': String(attrs.mediaId) } : {},
      },
    }
  },
})

/** Оборачивает верхнеуровневые <img> в <figure> — для htmlToLexical. */
function wrapImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (m) => `<figure>${m}</figure>`)
}

export function TiptapEditor({
  initialHtml = '',
  onChange,
  placeholder,
  uploadEndpoint = '/studio/api/upload-cover',
}: Props) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [imgError, setImgError] = useState<string | null>(null)

  const editor = useEditor({
    immediatelyRender: false, // Next SSR — без гидрационных рассинхронов
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        link: false,
      }),
      MediaImage.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder || '' }),
    ],
    content: initialHtml || '',
    editorProps: {
      attributes: {
        class: 'rte__editable',
      },
    },
    onUpdate: ({ editor }) => {
      onChangeRef.current?.(wrapImages(editor.getHTML()))
    },
  })

  async function handleImageFile(file: File) {
    if (!editor) return
    setImgError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(uploadEndpoint, { method: 'POST', body: fd, credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.url || json?.id == null) {
        setImgError(json?.error || 'Не удалось загрузить изображение')
        return
      }
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'image',
          attrs: { src: String(json.url), mediaId: String(json.id), alt: '' },
        })
        .run()
    } catch {
      setImgError('Ошибка загрузки изображения')
    } finally {
      setUploading(false)
    }
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleImageFile(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const btn = (
    active: boolean,
    onClick: () => void,
    icon: React.ReactNode,
    title: string,
    disabled = false,
  ) => (
    <button
      type="button"
      className={`rte__btn${active ? ' is-active' : ''}`}
      disabled={disabled || !editor}
      onMouseDown={(e) => {
        e.preventDefault()
        if (editor) onClick()
      }}
      title={title}
    >
      {icon}
    </button>
  )

  return (
    <div className="rte">
      <div className="rte__toolbar">
        {btn(
          Boolean(editor?.isActive('paragraph')),
          () => editor!.chain().focus().setParagraph().run(),
          <Pilcrow size={16} />,
          'Обычный текст',
        )}
        {btn(
          Boolean(editor?.isActive('heading', { level: 2 })),
          () => editor!.chain().focus().toggleHeading({ level: 2 }).run(),
          <Heading2 size={16} />,
          'Заголовок H2',
        )}
        {btn(
          Boolean(editor?.isActive('heading', { level: 3 })),
          () => editor!.chain().focus().toggleHeading({ level: 3 }).run(),
          <Heading3 size={16} />,
          'Подзаголовок H3',
        )}
        <span className="rte__divider" />
        {btn(
          Boolean(editor?.isActive('bold')),
          () => editor!.chain().focus().toggleBold().run(),
          <Bold size={16} />,
          'Жирный (Ctrl+B)',
        )}
        {btn(
          Boolean(editor?.isActive('italic')),
          () => editor!.chain().focus().toggleItalic().run(),
          <Italic size={16} />,
          'Курсив (Ctrl+I)',
        )}
        {btn(
          Boolean(editor?.isActive('underline')),
          () => editor!.chain().focus().toggleUnderline().run(),
          <Underline size={16} />,
          'Подчёркнутый (Ctrl+U)',
        )}
        {btn(
          Boolean(editor?.isActive('strike')),
          () => editor!.chain().focus().toggleStrike().run(),
          <Strikethrough size={16} />,
          'Зачёркнутый',
        )}
        <span className="rte__divider" />
        {btn(
          Boolean(editor?.isActive('bulletList')),
          () => editor!.chain().focus().toggleBulletList().run(),
          <List size={16} />,
          'Маркированный список',
        )}
        {btn(
          Boolean(editor?.isActive('orderedList')),
          () => editor!.chain().focus().toggleOrderedList().run(),
          <ListOrdered size={16} />,
          'Нумерованный список',
        )}
        <span className="rte__divider" />
        <button
          type="button"
          className="rte__btn"
          disabled={uploading || !editor}
          onMouseDown={(e) => {
            e.preventDefault()
            if (!uploading && editor) fileRef.current?.click()
          }}
          title="Вставить изображение"
        >
          {uploading ? <Loader2 size={16} className="rte__spin" /> : <ImagePlus size={16} />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
      </div>

      {imgError && <div className="rte__error">{imgError}</div>}

      <div className="rte__wrap">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
