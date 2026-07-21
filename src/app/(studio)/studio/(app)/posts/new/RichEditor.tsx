'use client'

import React, { useRef, useEffect, useCallback, useState } from 'react'
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered } from 'lucide-react'

/**
 * Лёгкий rich-редактор на contentEditable. Выдаёт HTML (через onChange),
 * который сервер конвертирует в Lexical (htmlToLexical). Начальное значение —
 * HTML из lexicalToHtml.
 *
 * Форматирование через document.execCommand — старый API, но для bold/italic/
 * underline/strikethrough/списков он поддержан во всех браузерах и не требует
 * зависимостей. Достаточно для «пиши как в соцсети».
 */

type Props = {
  initialHtml?: string
  onChange: (html: string) => void
  placeholder?: string
}

export function RichEditor({ initialHtml = '', onChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<Record<string, boolean>>({})
  const [empty, setEmpty] = useState(!initialHtml)

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
    // считаем пустым, если только <br> или пустой параграф
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

  function onInput() {
    emit()
    refreshActive()
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
        {toolBtn('bold', 'bold', <Bold size={16} />, 'Жирный (Ctrl+B)')}
        {toolBtn('italic', 'italic', <Italic size={16} />, 'Курсив (Ctrl+I)')}
        {toolBtn('underline', 'underline', <Underline size={16} />, 'Подчёркнутый (Ctrl+U)')}
        {toolBtn('strikeThrough', 'strikeThrough', <Strikethrough size={16} />, 'Зачёркнутый')}
        <span className="rte__divider" />
        {toolBtn('insertUnorderedList', 'ul', <List size={16} />, 'Маркированный список')}
        {toolBtn('insertOrderedList', 'ol', <ListOrdered size={16} />, 'Нумерованный список')}
      </div>

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
