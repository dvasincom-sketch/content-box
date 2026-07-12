import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import React from 'react'
import { extractLexicalText } from '@/utils/lexicalText'
import { categoryHref } from '@/lib/categoryHref'

/**
 * SEO-аудит: сводная таблица по всем категориям тенанта с подсветкой проблем.
 * Root-view под /admin/seo-audit. Данные грузятся через Local API прямо здесь
 * (серверный компонент). Тенант берётся из preferences/первого доступного —
 * см. resolveTenant ниже.
 *
 * Флаги проблем на строку:
 *  - no-desc:      нет SEO-description (и нет исходного описания для генерации)
 *  - title-long:   SEO-title длиннее лимита
 *  - desc-long:    SEO-description длиннее лимита
 *  - title-short:  SEO-title подозрительно короткий
 */

const TITLE_MAX = 60
const DESC_MAX = 160
const TITLE_MIN = 15

type Crumb = { url?: string | null; label?: string | null }
type Cat = {
  id: number | string
  title?: string | null
  fullTitle?: string | null
  slug?: string | null
  description?: unknown
  breadcrumbs?: Crumb[] | null
  seo?: { title?: string | null; description?: string | null } | null
  parent?: unknown
}

type Issue = 'no-desc' | 'title-long' | 'desc-long' | 'title-short' | 'no-title'

function auditRow(cat: Cat): Issue[] {
  const issues: Issue[] = []
  const seoTitle = cat.seo?.title?.trim() || ''
  const seoDesc = cat.seo?.description?.trim() || ''
  const hasSourceText = extractLexicalText(cat.description).length > 0

  if (!seoTitle) issues.push('no-title')
  else {
    if (seoTitle.length > TITLE_MAX) issues.push('title-long')
    if (seoTitle.length < TITLE_MIN) issues.push('title-short')
  }

  // Нет описания только если и SEO-desc пуст, и генерировать не из чего.
  if (!seoDesc && !hasSourceText) issues.push('no-desc')
  else if (seoDesc.length > DESC_MAX) issues.push('desc-long')

  return issues
}

const ISSUE_LABEL: Record<Issue, string> = {
  'no-title': 'нет SEO-title',
  'no-desc': 'нет описания',
  'title-long': `title > ${TITLE_MAX}`,
  'title-short': `title < ${TITLE_MIN}`,
  'desc-long': `desc > ${DESC_MAX}`,
}

export default async function SeoAuditView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, permissions, locale, visibleEntities } = initPageResult
  const { user, payload } = req

  // Безопасность: только залогиненные.
  if (!user) {
    return (
      <Gutter>
        <p>Требуется вход в систему.</p>
      </Gutter>
    )
  }

  // Тенант: берём из связки пользователя (как в остальной админке).
  // Пользователь может иметь несколько тенантов — берём первый.
  const tenantRel = (user as any)?.tenants?.[0]?.tenant ?? (user as any)?.tenant
  const tenantId =
    tenantRel && typeof tenantRel === 'object' ? tenantRel.id : tenantRel

  const catsRes = await payload.find({
    collection: 'categories',
    where: tenantId ? { tenant: { equals: tenantId } } : {},
    limit: 0,
    depth: 1,
    overrideAccess: true,
    sort: 'fullTitle',
  })
  const cats = catsRes.docs as Cat[]

  // Считаем, кто с проблемами.
  const rows = cats.map((c) => ({ cat: c, issues: auditRow(c) }))
  const problems = rows.filter((r) => r.issues.length > 0)
  const clean = rows.length - problems.length

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user || undefined}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <h1 style={{ marginBottom: 8 }}>SEO-аудит категорий</h1>
        <p style={{ marginBottom: 24, opacity: 0.7 }}>
          Всего: {rows.length} · С проблемами: {problems.length} · В порядке: {clean}
        </p>

        {problems.length === 0 ? (
          <p>Проблем не найдено — все категории заполнены корректно.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--theme-elevation-150)' }}>
                  <th style={{ padding: '8px 12px' }}>Категория</th>
                  <th style={{ padding: '8px 12px' }}>SEO Title</th>
                  <th style={{ padding: '8px 12px' }}>SEO Description</th>
                  <th style={{ padding: '8px 12px' }}>Проблемы</th>
                </tr>
              </thead>
              <tbody>
                {problems.map(({ cat, issues }) => {
                  const href = categoryHref(cat)
                  const editUrl = `/admin/collections/categories/${cat.id}`
                  const seoTitle = cat.seo?.title || ''
                  const seoDesc = cat.seo?.description || ''
                  return (
                    <tr
                      key={cat.id}
                      style={{
                        borderBottom: '1px solid var(--theme-elevation-100)',
                        background: 'var(--theme-error-50, rgba(255,0,0,0.03))',
                      }}
                    >
                      <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                        <a href={editUrl} style={{ fontWeight: 600 }}>
                          {cat.fullTitle || cat.title}
                        </a>
                        <div style={{ opacity: 0.5, fontSize: 11 }}>{href}</div>
                      </td>
                      <td style={{ padding: '8px 12px', verticalAlign: 'top', maxWidth: 260 }}>
                        <span style={{ color: seoTitle.length > TITLE_MAX ? 'var(--theme-error-500)' : 'inherit' }}>
                          {seoTitle || '—'}
                        </span>
                        {seoTitle && (
                          <div style={{ opacity: 0.5, fontSize: 11 }}>{seoTitle.length} симв.</div>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', verticalAlign: 'top', maxWidth: 320 }}>
                        <span style={{ color: seoDesc.length > DESC_MAX ? 'var(--theme-error-500)' : 'inherit' }}>
                          {seoDesc ? seoDesc.slice(0, 120) + (seoDesc.length > 120 ? '…' : '') : '—'}
                        </span>
                        {seoDesc && (
                          <div style={{ opacity: 0.5, fontSize: 11 }}>{seoDesc.length} симв.</div>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {issues.map((iss) => (
                            <span
                              key={iss}
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                background: 'var(--theme-error-100, rgba(255,0,0,0.1))',
                                color: 'var(--theme-error-600, #b00)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {ISSUE_LABEL[iss]}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}
