import React from 'react'
import Link from 'next/link'
import type { WidgetServerProps } from 'payload'
import { getUserTenantID } from '@/access'

/**
 * Виджет «Последние публикации» — пять свежих записей тенанта
 * со ссылками на редактирование. Показывается только editor'у.
 */
export default async function RecentPublicationsWidget({ req }: WidgetServerProps) {
  const { payload, user } = req
  const tenantID = getUserTenantID(user as any)
  if (!tenantID) return null

  const res = await payload.find({
    collection: 'publications',
    where: { tenant: { equals: tenantID } },
    sort: '-publishedAt',
    limit: 5,
    depth: 0,
    overrideAccess: true,
  })

  const docs = res.docs as any[]

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: 'var(--theme-text)' }}>Последние публикации</h3>
      {docs.length === 0 ? (
        <p style={{ margin: 0, opacity: 0.65, fontSize: '0.85rem', color: 'var(--theme-text)' }}>
          Пока ничего не опубликовано.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {docs.map((doc) => (
            <li
              key={doc.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid var(--theme-elevation-100)',
              }}
            >
              <Link
                href={`/admin/collections/publications/${doc.id}`}
                style={{ color: 'var(--theme-text)', textDecoration: 'none', fontSize: '0.9rem' }}
              >
                {doc.title}
              </Link>
              <span style={{ fontSize: '0.75rem', opacity: 0.55, color: 'var(--theme-text)', whiteSpace: 'nowrap' }}>
                {doc.publishedAt
                  ? new Date(doc.publishedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
                  : 'без даты'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
