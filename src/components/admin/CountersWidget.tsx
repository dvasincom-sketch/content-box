import React from 'react'
import type { WidgetServerProps, Where } from 'payload'
import { isSuperAdmin, getUserTenantID } from '@/access'

/**
 * Виджет «Счётчики» — сводка по контенту.
 * Editor видит свой тенант, суперадмин — платформу целиком.
 */
export default async function CountersWidget({ req }: WidgetServerProps) {
  const { payload, user } = req
  const superAdmin = isSuperAdmin(user as any)
  const tenantID = getUserTenantID(user as any)

  const scope: Where | undefined = superAdmin ? undefined : { tenant: { equals: tenantID } }

  const [publications, categories, pages, tenants, users] = await Promise.all([
    payload.count({ collection: 'publications', where: scope, overrideAccess: true }),
    payload.count({ collection: 'categories', where: scope, overrideAccess: true }),
    payload.count({ collection: 'pages', where: scope, overrideAccess: true }),
    superAdmin ? payload.count({ collection: 'tenants', overrideAccess: true }) : null,
    superAdmin ? payload.count({ collection: 'users', overrideAccess: true }) : null,
  ])

  const items = superAdmin
    ? [
        { label: 'Проектов', value: tenants?.totalDocs ?? 0 },
        { label: 'Пользователей', value: users?.totalDocs ?? 0 },
        { label: 'Публикаций', value: publications.totalDocs },
      ]
    : [
        { label: 'Публикаций', value: publications.totalDocs },
        { label: 'Категорий', value: categories.totalDocs },
        { label: 'Страниц', value: pages.totalDocs },
      ]

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: 'var(--theme-text)' }}>Сводка</h3>
      <div style={{ display: 'flex', gap: '2rem' }}>
        {items.map((item) => (
          <div key={item.label}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--theme-text)', lineHeight: 1.1 }}>
              {item.value}
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.65, color: 'var(--theme-text)' }}>{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
