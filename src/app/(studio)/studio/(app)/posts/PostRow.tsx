import React from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'

/**
 * Строка публикации в ленте. Статус выводим из publishedAt:
 *   - нет даты или дата в будущем → черновик;
 *   - дата в прошлом → опубликовано.
 * (Отдельного поля статуса в схеме нет — это разумный дефолт без миграции.)
 */

type PubDoc = {
  id: number | string
  title?: string
  slug?: string
  publishedAt?: string | null
  featured?: boolean
  cover?: any
  category?: any
  minTier?: any
}

function statusOf(doc: PubDoc): { label: string; kind: 'published' | 'draft' } {
  if (!doc.publishedAt) return { label: 'Черновик', kind: 'draft' }
  const when = new Date(doc.publishedAt).getTime()
  if (Number.isNaN(when) || when > Date.now()) return { label: 'Черновик', kind: 'draft' }
  return { label: 'Опубликовано', kind: 'published' }
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function PostRow({ doc }: { doc: PubDoc }) {
  const status = statusOf(doc)
  const coverUrl =
    doc.cover && typeof doc.cover === 'object' ? doc.cover.url : null
  const categoryTitle =
    doc.category && typeof doc.category === 'object'
      ? doc.category.title || doc.category.name
      : null
  const minTierName =
    doc.minTier && typeof doc.minTier === 'object'
      ? doc.minTier.name || doc.minTier.slug
      : null

  return (
    <Link href={`/studio/posts/${doc.id}`} className="studio-row">
      <div className="studio-row__cover">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" />
        ) : (
          <div className="studio-row__cover-empty" aria-hidden />
        )}
      </div>

      <div className="studio-row__main">
        <div className="studio-row__title">
          {doc.title || 'Без заголовка'}
          {doc.featured && <span className="studio-tag studio-tag--featured">Featured</span>}
        </div>
        <div className="studio-row__meta">
          {categoryTitle && <span>{categoryTitle}</span>}
          {categoryTitle && <span className="studio-row__dot">·</span>}
          <span>{formatDate(doc.publishedAt)}</span>
        </div>
      </div>

      <div className="studio-row__tags">
        {minTierName && (
          <span className="vid__badge">
            <Lock size={12} /> {minTierName}
          </span>
        )}
        <span className={`studio-status studio-status--${status.kind}`}>{status.label}</span>
      </div>
    </Link>
  )
}
