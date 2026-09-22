"use client"
import React, { useState } from 'react'
import Link from '@/components/AppLink'
import { ChevronDown } from 'lucide-react'
import type { MenuNode } from '@/lib/buildMenu'

/**
 * Мобильное меню: аккордеон. У раздела с вложенностью тап по строке раскрывает
 * аккордеон (а не уходит на страницу раздела) — так удобнее добраться до
 * подпунктов. Лист (без детей) — обычная ссылка-переход. Отступ показывает
 * уровень.
 *
 * Цвет стрелки берётся из currentColor той же строки (класс c-navlink), поэтому
 * совпадает с цветом текста при любой теме/пресете (в т.ч. когда пресет
 * переопределяет `header .c-navlink`).
 */
function AccordionNode({
  node,
  level,
  onNavigate,
}: {
  node: MenuNode
  level: number
  onNavigate: () => void
}) {
  const [open, setOpen] = useState(false)
  const hasChildren = node.children.length > 0

  const rowStyle: React.CSSProperties = { paddingLeft: `${(level - 1) * 14}px` }
  const labelStyle: React.CSSProperties = {
    fontWeight: level === 1 ? 600 : 400,
    fontSize: level >= 3 ? '0.9rem' : undefined,
  }

  return (
    <li>
      {hasChildren ? (
        // Раздел с вложенностью: тап по всей строке раскрывает/сворачивает
        // аккордеон. Кнопка несёт класс c-navlink, стрелка наследует его цвет.
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? `Свернуть «${node.title}»` : `Развернуть «${node.title}»`}
          onClick={() => setOpen((v) => !v)}
          className="c-navlink flex items-center w-full text-left"
          style={{ ...rowStyle, background: 'transparent', border: 0, cursor: 'pointer' }}
        >
          <span className="flex-1 py-2.5 px-2 rounded-lg text-base" style={labelStyle}>
            {node.title}
          </span>
          <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg shrink-0" aria-hidden>
            <ChevronDown
              size={16}
              style={{
                transition: 'transform 150ms',
                transform: open ? 'rotate(180deg)' : 'none',
                color: 'currentColor',
              }}
            />
          </span>
        </button>
      ) : (
        <div className="flex items-center" style={rowStyle}>
          <Link
            href={node.href}
            prefetch={false}
            onClick={onNavigate}
            className="flex-1 py-2.5 px-2 rounded-lg text-base c-navlink"
            style={labelStyle}
          >
            {node.title}
          </Link>
        </div>
      )}

      {hasChildren && open && (
        <ul>
          {node.children.map((child) => (
            <AccordionNode key={child.id} node={child} level={level + 1} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function MobileMenu({
  nodes,
  onNavigate,
}: {
  nodes: MenuNode[]
  onNavigate: () => void
}) {
  if (nodes.length === 0) return null
  return (
    <ul className="flex flex-col">
      {nodes.map((node) => (
        <AccordionNode key={node.id} node={node} level={1} onNavigate={onNavigate} />
      ))}
    </ul>
  )
}
