import React from 'react'
import Link from 'next/link'
import type { WidgetServerProps } from 'payload'
import { isSuperAdmin } from '@/access'

type Action = { label: string; href: string }

/**
 * Виджет «Быстрые действия» — прямые ссылки на создание записей.
 * Набор кнопок зависит от роли.
 */
export default function QuickActionsWidget({ req }: WidgetServerProps) {
  const superAdmin = isSuperAdmin(req.user as any)

  const actions: Action[] = superAdmin
    ? [
        { label: '+ Проект', href: '/admin/collections/tenants/create' },
        { label: '+ Пользователь', href: '/admin/collections/users/create' },
      ]
    : [
        { label: '+ Публикация', href: '/admin/collections/publications/create' },
        { label: '+ Страница', href: '/admin/collections/pages/create' },
        { label: '+ Категория', href: '/admin/collections/categories/create' },
      ]

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: 'var(--theme-text)' }}>Быстрые действия</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.55rem 1rem',
              borderRadius: '4px',
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
              background: 'var(--theme-elevation-100)',
              color: 'var(--theme-text)',
              border: '1px solid var(--theme-elevation-150)',
            }}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
