"use client"
import React, { useState, useRef } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { MenuNode } from '@/lib/headerMenu'

const SURFACE = 'var(--brand-surface)'
const BORDER = 'color-mix(in srgb, var(--brand-text) 12%, transparent)'
const HOVER = 'color-mix(in srgb, var(--brand-primary) 15%, transparent)'

/** Вложенный список 2-го уровня и глубже. Раскрывается вправо по наведению. */
function SubMenu({ nodes, level }: { nodes: MenuNode[]; level: number }) {
  const [openID, setOpenID] = useState<number | null>(null)

  return (
    <ul
      className="absolute min-w-[220px] py-2 rounded-xl shadow-xl z-50"
      style={{
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        // 2-й уровень падает вниз, глубже — вправо от родителя
        ...(level === 2 ? { top: '100%', left: 0 } : { top: 0, left: '100%' }),
      }}
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
            <Link
              href={node.href}
              className="flex items-center justify-between gap-3 px-4 py-2 text-sm transition-colors"
              style={{ color: 'var(--brand-text)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = HOVER)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span>{node.title}</span>
              {hasChildren && <ChevronRight size={14} className="shrink-0 opacity-60" />}
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

  // Небольшая задержка на уход мыши: не схлопывается при переходе к списку.
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
              className="flex items-center gap-1 text-sm font-medium opacity-80 hover:opacity-100 transition-opacity py-2"
              style={{ color: 'var(--brand-text)' }}
              aria-expanded={hasChildren ? openID === node.id : undefined}
              aria-haspopup={hasChildren || undefined}
            >
              {node.title}
              {hasChildren && <ChevronDown size={14} className="opacity-60" />}
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
