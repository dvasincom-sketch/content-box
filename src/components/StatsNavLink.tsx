'use client'
import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

/**
 * Пункт меню «Статистика» → /admin/stats (кастомная view-заглушка).
 * Payload не добавляет ссылки для кастомных root-view автоматически.
 */
export default function StatsNavLink() {
  const pathname = usePathname()
  const href = '/admin/stats'
  const active = pathname === href

  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '8px 0',
        fontWeight: active ? 700 : 400,
        opacity: active ? 1 : 0.8,
        textDecoration: 'none',
      }}
    >
      Статистика
    </Link>
  )
}
