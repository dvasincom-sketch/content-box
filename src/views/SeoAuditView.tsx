import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import React from 'react'
import { extractLexicalText, extractHeadings, wordCount } from '@/utils/lexicalText'
import { categoryHref } from '@/lib/categoryHref'

/**
 * SEO-аудит категорий (root-view /admin/seo-audit).
 *
 * Проверяет:
 *  - дубликаты SEO-title между категориями
 *  - дубликаты SEO-description между категориями
 *  - отсутствие OG-изображения
 *  - длину description (слишком коротко / слишком длинно)
 *  - отсутствие description (только для «контентных» категорий)
 *  - структуру заголовков H2/H3 внутри Lexical-описания
 *
 * Пустые навигационные категории (контейнеры без описания, галереи,
 * sns-архивы) из аудита ИСКЛЮЧЕНЫ — им SEO-контент не нужен, они
 * засоряли бы список ложными тревогами.
 */

const TITLE_MAX = 60
const DESC_MIN = 50
const DESC_MAX = 160
const LONG_TEXT_WORDS = 120 // с какого объёма ждём подзаголовки

type Crumb = { url?: string | null; label?: string | null }
type Cat = {
  id: number | string
  title?: string | null
  fullTitle?: string | null
  slug?: string | null
  description?: unknown
  breadcrumbs?: Crumb[] | null
  seo?: { title?: string | null; description?: string | null; ogImage?: unknown } | null
  parent?: unknown
  targetKeywords?: { keyword?: string | null }[] | null
}

type IssueKind =
  | 'no-desc'
  | 'desc-short'
  | 'desc-long'
  | 'title-long'
  | 'title-dup'
  | 'desc-dup'
  | 'no-og'
  | 'headings-missing'
  | 'headings-skip'
  | 'kw-missing'

type Issue = { kind: IssueKind; detail?: string }

const ISSUE_LABEL: Record<IssueKind, string> = {
  'no-desc': 'нет описания',
  'desc-short': `описание < ${DESC_MIN}`,
  'desc-long': `описание > ${DESC_MAX}`,
  'title-long': `title > ${TITLE_MAX}`,
  'title-dup': 'дубль title',
  'desc-dup': 'дубль description',
  'no-og': 'нет OG-картинки',
  'headings-missing': 'нет подзаголовков',
  'headings-skip': 'скачок уровней H',
  'kw-missing': 'keyword не в title/desc',
}

// Пустая навигационная категория, которую не нужно аудитить.
function isNavigationalOrGallery(cat: Cat, hasChildren: boolean): boolean {
  const path = cat.breadcrumbs?.map((c) => c.url).join('') || ''
  // Галереи и sns-архивы — фото-разделы без текста.
  if (path.includes('/galleries')) return true
  // Контейнер без описания — навигационный, ему SEO-описание не нужно.
  const hasDesc = extractLexicalText(cat.description).length > 0
  if (hasChildren && !hasDesc) return true
  return false
}

function hasOgImage(seo: Cat['seo']): boolean {
  const og = seo?.ogImage
  if (!og) return false
  if (typeof og === 'object') return Boolean((og as { id?: unknown }).id)
  return Boolean(og)
}

export default async function SeoAuditView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, permissions, locale, visibleEntities } = initPageResult
  const { user, payload } = req

  if (!user) {
    return (
      <Gutter>
        <p>Требуется вход в систему.</p>
      </Gutter>
    )
  }

  const tenantRel = (user as any)?.tenants?.[0]?.tenant ?? (user as any)?.tenant
  const tenantId = tenantRel && typeof tenantRel === 'object' ? tenantRel.id : tenantRel

  const catsRes = await payload.find({
    collection: 'categories',
    where: tenantId ? { tenant: { equals: tenantId } } : {},
    limit: 0,
    depth: 1,
    overrideAccess: true,
    sort: 'fullTitle',
  })
  const cats = catsRes.docs as Cat[]

  // Кто является родителем (есть дети).
  const parentIds = new Set<string>()
  for (const c of cats) {
    const p = c.parent
    const pid = p && typeof p === 'object' ? (p as { id?: unknown }).id : p
    if (pid != null) parentIds.add(String(pid))
  }

  // Индексы для поиска дубликатов (по нормализованному значению → список id).
  const titleMap = new Map<string, Cat[]>()
  const descMap = new Map<string, Cat[]>()
  for (const c of cats) {
    const t = (c.seo?.title || '').trim().toLowerCase()
    const d = (c.seo?.description || '').trim().toLowerCase()
    if (t) {
      const arr = titleMap.get(t) || []
      arr.push(c)
      titleMap.set(t, arr)
    }
    if (d) {
      const arr = descMap.get(d) || []
      arr.push(c)
      descMap.set(d, arr)
    }
  }

  // Аудит одной категории.
  function audit(cat: Cat): Issue[] {
    const issues: Issue[] = []
    const seoTitle = (cat.seo?.title || '').trim()
    const seoDesc = (cat.seo?.description || '').trim()
    const text = extractLexicalText(cat.description)

    // Дубликаты.
    const tKey = seoTitle.toLowerCase()
    if (tKey) {
      const dupes = (titleMap.get(tKey) || []).filter((x) => x.id !== cat.id)
      if (dupes.length > 0) {
        issues.push({
          kind: 'title-dup',
          detail: dupes.map((x) => x.fullTitle || x.title).slice(0, 3).join('; '),
        })
      }
    }
    const dKey = seoDesc.toLowerCase()
    if (dKey) {
      const dupes = (descMap.get(dKey) || []).filter((x) => x.id !== cat.id)
      if (dupes.length > 0) {
        issues.push({
          kind: 'desc-dup',
          detail: dupes.map((x) => x.fullTitle || x.title).slice(0, 3).join('; '),
        })
      }
    }

    // Title length.
    if (seoTitle.length > TITLE_MAX) issues.push({ kind: 'title-long' })

    // Description.
    if (!seoDesc) {
      issues.push({ kind: 'no-desc' })
    } else {
      if (seoDesc.length < DESC_MIN) issues.push({ kind: 'desc-short' })
      if (seoDesc.length > DESC_MAX) issues.push({ kind: 'desc-long' })
    }

    // OG-изображение.
    if (!hasOgImage(cat.seo)) issues.push({ kind: 'no-og' })

    // Заголовки внутри описания.
    if (text.length > 0) {
      const headings = extractHeadings(cat.description)
      const words = wordCount(text)
      if (words >= LONG_TEXT_WORDS && headings.length === 0) {
        issues.push({ kind: 'headings-missing' })
      }
      // Скачок уровней: h2 → h4 без h3.
      let prev = 1
      for (const h of headings) {
        if (h.level - prev > 1) {
          issues.push({ kind: 'headings-skip', detail: `H${prev}→H${h.level}` })
          break
        }
        prev = h.level
      }
    }

    // Целевые keywords: хотя бы один топовый должен встречаться в title/desc.
    const kws = (cat.targetKeywords || [])
      .map((k) => (k.keyword || '').trim().toLowerCase())
      .filter(Boolean)
    if (kws.length > 0) {
      const haystack = `${seoTitle} ${seoDesc}`.toLowerCase()
      // Берём топ-3 (они первыми в массиве после импорта — по частотности).
      const primary = kws.slice(0, 3)
      const covered = primary.some((kw) => haystack.includes(kw))
      if (!covered) {
        issues.push({ kind: 'kw-missing', detail: primary.join('; ') })
      }
    }

    return issues
  }

  const rows = cats
    .map((cat) => {
      const hasChildren = parentIds.has(String(cat.id))
      return { cat, hasChildren }
    })
    // Скрываем пустые навигационные и галереи.
    .filter(({ cat, hasChildren }) => !isNavigationalOrGallery(cat, hasChildren))
    .map(({ cat }) => ({ cat, issues: audit(cat) }))

  const problems = rows.filter((r) => r.issues.length > 0)
  const clean = rows.length - problems.length
  const hidden = cats.length - rows.length

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
          Аудируется: {rows.length} · С проблемами: {problems.length} · В порядке: {clean} ·
          Скрыто пустых/навигационных: {hidden}
        </p>

        {problems.length === 0 ? (
          <p>Проблем не найдено — контентные категории заполнены корректно.</p>
        ) : (
          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <table
              style={{
                width: '100%',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                fontSize: 13,
              }}
            >
              <colgroup>
                <col style={{ width: '26%' }} />
                <col style={{ width: '24%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '22%' }} />
              </colgroup>
              <thead>
                <tr
                  style={{
                    textAlign: 'left',
                    borderBottom: '2px solid var(--theme-elevation-150)',
                  }}
                >
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
                      }}
                    >
                      <td
                        style={{
                          padding: '8px 12px',
                          verticalAlign: 'top',
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        <a href={editUrl} style={{ fontWeight: 600 }}>
                          {cat.fullTitle || cat.title}
                        </a>
                        <div style={{ opacity: 0.5, fontSize: 11 }}>{href}</div>
                      </td>
                      <td
                        style={{
                          padding: '8px 12px',
                          verticalAlign: 'top',
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        <span
                          style={{
                            color:
                              seoTitle.length > TITLE_MAX ? 'var(--theme-error-500)' : 'inherit',
                          }}
                        >
                          {seoTitle || '—'}
                        </span>
                        {seoTitle && (
                          <div style={{ opacity: 0.5, fontSize: 11 }}>{seoTitle.length} симв.</div>
                        )}
                      </td>
                      <td
                        style={{
                          padding: '8px 12px',
                          verticalAlign: 'top',
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        <span
                          style={{
                            color:
                              seoDesc.length > DESC_MAX || (seoDesc && seoDesc.length < DESC_MIN)
                                ? 'var(--theme-error-500)'
                                : 'inherit',
                          }}
                        >
                          {seoDesc
                            ? seoDesc.slice(0, 110) + (seoDesc.length > 110 ? '…' : '')
                            : '—'}
                        </span>
                        {seoDesc && (
                          <div style={{ opacity: 0.5, fontSize: 11 }}>{seoDesc.length} симв.</div>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {issues.map((iss, i) => (
                            <span
                              key={i}
                              title={iss.detail || ''}
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                background: 'var(--theme-error-100, rgba(255,0,0,0.1))',
                                color: 'var(--theme-error-600, #b00)',
                                maxWidth: '100%',
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {ISSUE_LABEL[iss.kind]}
                              {iss.detail ? ` (${iss.detail.slice(0, 18)}${iss.detail.length > 18 ? '…' : ''})` : ''}
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
