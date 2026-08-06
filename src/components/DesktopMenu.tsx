"use client"
import React, { useState, useRef } from 'react'
import Link from '@/components/AppLink'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { MenuNode } from '@/lib/buildMenu'

/** Вложенный список 2-го уровня и глубже. Раскрывается вправо по наведению.
 *  Панель — стеклянный .c-popover, пункты — .c-popover__item (hover/фокус в CSS). */
function SubMenu({ nodes, level }: { nodes: MenuNode[]; level: number }) {
  const [openID, setOpenID] = useState<number | null>(null)

  return (
    <ul
      className="c-popover absolute min-w-[220px] z-50"
      style={level === 2 ? { top: '100%', left: 0 } : { top: 0, left: '100%' }}
    >
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0
        return (
          <li
            key={node.id}
            className="relative"
            onMouseEnter={() => setOpenID(node.id)}
            onMouseLeave={() => setOpenID(null)}
          >
            <Link href={node.href} prefetch={false} className="c-popover__item text-sm">
              <span>{node.title}</span>
              {hasChildren && <ChevronRight size={14} className="shrink-0" style={{ color: 'var(--brand-muted)' }} />}
            </Link>

            {hasChildren && openID === node.id && (
              <SubMenu nodes={node.children} level={level + 1} />
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Десктопное меню: корневые пункты, дропдауны по наведению. */
export function DesktopMenu({ nodes }: { nodes: MenuNode[] }) {
  const [openID, setOpenID] = useState<number | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpenID(null), 120)
  }
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }

  if (nodes.length === 0) return null

  return (
    <>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0
        return (
          <div
            key={node.id}
            className="relative"
            onMouseEnter={() => {
              cancelClose()
              setOpenID(node.id)
            }}
            onMouseLeave={scheduleClose}
          >
            <Link
              href={node.href}
              prefetch={false}
              className="flex items-center gap-1 text-sm font-medium c-navlink py-2"
              aria-expanded={hasChildren ? openID === node.id : undefined}
              aria-haspopup={hasChildren || undefined}
            >
              {node.title}
              {hasChildren && <ChevronDown size={14} style={{ color: 'currentColor', opacity: 0.7 }} />}
            </Link>

            {hasChildren && openID === node.id && (
              <SubMenu nodes={node.children} level={2} />
            )}
          </div>
        )
      })}
    </>
  )
}
