"use client"
import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import type { MenuNode } from '@/lib/headerMenu'

/**
 * Мобильное меню: аккордеон. Тап по стрелке раскрывает вложенность,
 * тап по названию — переход. Отступ показывает уровень.
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

  return (
    <li>
      <div className="flex items-center" style={{ paddingLeft: `${(level - 1) * 14}px` }}>
        <Link
          href={node.href}
          onClick={onNavigate}
          className="flex-1 py-2.5 px-2 rounded-lg text-base opacity-90 hover:opacity-100"
          style={{
            color: 'var(--brand-text)',
            fontWeight: level === 1 ? 600 : 400,
            fontSize: level >= 3 ? '0.9rem' : undefined,
          }}
        >
          {node.title}
        </Link>

        {hasChildren && (
          <button
            type="button"
            aria-label={open ? 'Свернуть' : 'Развернуть'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg shrink-0"
            style={{ color: 'var(--brand-text)' }}
          >
            <ChevronDown
              size={16}
              style={{
                transition: 'transform 150ms',
                transform: open ? 'rotate(180deg)' : 'none',
                opacity: 0.6,
              }}
            />
          </button>
        )}
      </div>

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
