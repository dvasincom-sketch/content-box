'use client'
import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

/**
 * Пункт бокового меню, ведущий на кастомную SEO-аудит view.
 * Payload не добавляет ссылки для кастомных root-view автоматически,
 * поэтому линк добавляем вручную через admin.components.beforeNavLinks.
 */
export default function SeoAuditNavLink() {
  const pathname = usePathname()
  const href = '/admin/seo-audit'
  const active = pathname === href

  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '8px 0',
        fontWeight: active ? 700 : 400,
        opacity: active ? 1 : 0.8,
      }}
    >
      SEO-аудит
    </Link>
  )
}
