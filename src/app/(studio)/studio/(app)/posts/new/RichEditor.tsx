'use client'

import React, { useRef, useEffect, useCallback, useState } from 'react'
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
 * Лёгкий rich-редактор на contentEditable. Выдаёт HTML (через onChange),
 * который сервер конвертирует в Lexical (htmlToLexical). Начальное значение —
 * HTML из lexicalToHtml.
 *
 * Форматирование через document.execCommand — старый API, но для bold/italic/
 * underline/strikethrough/списков/formatBlock он поддержан во всех браузерах и
 * не требует зависимостей.
 *
 * Заголовки (H2/H3) — через formatBlock. Картинки — загрузка файла в media
 * (R2) через uploadEndpoint и вставка <figure data-media-id> в текст; сервер
 * (htmlToLexical) превращает её в upload-ноду Lexical, а публичный сайт
 * рендерит официальным конвертером Payload.
 */

type Props = {
  initialHtml?: string
  onChange: (html: string) => void
  placeholder?: string
  /** Эндпоинт загрузки изображения (multipart `file` → { id, url }). */
  uploadEndpoint?: string
}

export function RichEditor({
  initialHtml = '',
  onChange,
  placeholder,
  uploadEndpoint = '/studio/api/upload-cover',
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [active, setActive] = useState<Record<string, boolean>>({})
  const [block, setBlock] = useState<string>('p')
  const [empty, setEmpty] = useState(!initialHtml)
  const [uploading, setUploading] = useState(false)
  const [imgError, setImgError] = useState<string | null>(null)

  // Инициализация содержимого один раз
  useEffect(() => {
    if (ref.current && initialHtml) {
      ref.current.innerHTML = initialHtml
      setEmpty(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emit = useCallback(() => {
    if (!ref.current) return
    const html = ref.current.innerHTML
    // считаем пустым, если только <br> или пустой параграф (картинки/figure
    // считаются содержимым — их теги не вырезаем)
    const stripped = html.replace(/<br>/g, '').replace(/<\/?(p|div)>/g, '').trim()
    setEmpty(stripped.length === 0)
    onChange(html)
  }, [onChange])

  const refreshActive = useCallback(() => {
    try {
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
      })
      const b = (document.queryCommandValue('formatBlock') || '').toString().toLowerCase()
      setBlock(b || 'p')
    } catch {
      /* noop */
    }
  }, [])

  function exec(cmd: string) {
    ref.current?.focus()
    document.execCommand(cmd, false)
    emit()
    refreshActive()
  }

  // Переключение блока: если уже этот заголовок — вернуть в параграф.
  function toggleBlock(tag: 'h2' | 'h3') {
    ref.current?.focus()
    const current = (document.queryCommandValue('formatBlock') || '').toString().toLowerCase()
    document.execCommand('formatBlock', false, current === tag ? 'p' : tag)
    emit()
    refreshActive()
  }

  function setParagraph() {
    ref.current?.focus()
    document.execCommand('formatBlock', false, 'p')
    emit()
    refreshActive()
  }

  function onInput() {
    emit()
    refreshActive()
  }

  async function handleImageFile(file: File) {
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
      const url = String(json.url)
      const id = Number(json.id)
      const fig =
        `<figure data-media-id="${id}" contenteditable="false">` +
        `<img data-media-id="${id}" src="${url}" alt="" /></figure><p><br></p>`
      ref.current?.focus()
      document.execCommand('insertHTML', false, fig)
      emit()
      refreshActive()
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

  // Вставка из буфера: берём ТОЛЬКО чистый текст (без чужого HTML/стилей/data-*),
  // сохраняем структуру абзацев. Пустая строка → новый параграф, одиночный
  // перенос → <br>. Спецсимволы экранируем, чтобы текст не стал разметкой.
  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    if (!text) return

    const escape = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    // нормализуем переносы, режем на абзацы по пустым строкам
    const paragraphs = text
      .replace(/\r\n?/g, '\n')
      .split(/\n{2,}/)
      .map((para) => para.trim())
      .filter((para) => para.length > 0)
      .map((para) => {
        // одиночные переносы внутри абзаца → <br>
        const withBreaks = para
          .split('\n')
          .map((line) => escape(line))
          .join('<br>')
        return `<p>${withBreaks}</p>`
      })

    const html = paragraphs.join('')
    ref.current?.focus()
    document.execCommand('insertHTML', false, html || '<p></p>')
    emit()
    refreshActive()
  }

  const toolBtn = (
    cmd: string,
    key: string,
    icon: React.ReactNode,
    title: string,
  ) => (
    <button
      type="button"
      className={`rte__btn${active[key] ? ' is-active' : ''}`}
      onMouseDown={(e) => {
        e.preventDefault() // не терять выделение
        exec(cmd)
      }}
      title={title}
    >
      {icon}
    </button>
  )

  return (
    <div className="rte">
      <div className="rte__toolbar">
        <button
          type="button"
          className={`rte__btn${block === 'p' || !block ? ' is-active' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault()
            setParagraph()
          }}
          title="Обычный текст"
        >
          <Pilcrow size={16} />
        </button>
        <button
          type="button"
          className={`rte__btn${block === 'h2' ? ' is-active' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault()
            toggleBlock('h2')
          }}
          title="Заголовок H2"
        >
          <Heading2 size={16} />
        </button>
        <button
          type="button"
          className={`rte__btn${block === 'h3' ? ' is-active' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault()
            toggleBlock('h3')
          }}
          title="Подзаголовок H3"
        >
          <Heading3 size={16} />
        </button>
        <span className="rte__divider" />
        {toolBtn('bold', 'bold', <Bold size={16} />, 'Жирный (Ctrl+B)')}
        {toolBtn('italic', 'italic', <Italic size={16} />, 'Курсив (Ctrl+I)')}
        {toolBtn('underline', 'underline', <Underline size={16} />, 'Подчёркнутый (Ctrl+U)')}
        {toolBtn('strikeThrough', 'strikeThrough', <Strikethrough size={16} />, 'Зачёркнутый')}
        <span className="rte__divider" />
        {toolBtn('insertUnorderedList', 'ul', <List size={16} />, 'Маркированный список')}
        {toolBtn('insertOrderedList', 'ol', <ListOrdered size={16} />, 'Нумерованный список')}
        <span className="rte__divider" />
        <button
          type="button"
          className="rte__btn"
          disabled={uploading}
          onMouseDown={(e) => {
            e.preventDefault()
            if (!uploading) fileRef.current?.click()
          }}
          title="Вставить изображение"
        >
          {uploading ? <Loader2 size={16} className="rte__spin" /> : <ImagePlus size={16} />}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onPickImage}
        />
      </div>

      {imgError && <div className="rte__error">{imgError}</div>}

      <div className="rte__wrap">
        {empty && placeholder && <div className="rte__placeholder">{placeholder}</div>}
        <div
          ref={ref}
          className="rte__editable"
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          onPaste={onPaste}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          onBlur={emit}
        />
      </div>
    </div>
  )
}
