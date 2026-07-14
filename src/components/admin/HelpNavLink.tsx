'use client'
import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

/**
 * Пункт меню «Помощь» → /admin/help.
 */
export default function HelpNavLink() {
  const pathname = usePathname()
  const href = '/admin/help'
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
      Помощь
    </Link>
  )
}
