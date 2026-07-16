import React from 'react'
import Link from 'next/link'
import { Plus, FileText } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { PostRow } from './PostRow'

/**
 * Лента публикаций автора (Шаг 2). Список постов ТОЛЬКО своего тенанта.
 *
 * Безопасность: тенант берётся из сессии автора (getCurrentAuthor), НЕ из
 * заголовка x-tenant-id (на /api/* и серверных чтениях он не ставится).
 * overrideAccess:true в связке с явным фильтром tenant — стандартный приём
 * для scoped-чтения из Local API.
 */

export const dynamic = 'force-dynamic'

type PubDoc = {
  id: number | string
  title?: string
  slug?: string
  publishedAt?: string | null
  featured?: boolean
  cover?: any
  category?: any
}

export default async function StudioPostsPage() {
  const author = await getCurrentAuthor() // guard в (app)/layout гарантирует наличие
  const payload = await getPayload({ config: await config })

  const res = await payload.find({
    collection: 'publications',
    where: { tenant: { equals: author!.tenantId } },
    sort: '-publishedAt',
    limit: 100,
    depth: 1, // подтянуть cover и category
    overrideAccess: true,
  })

  const docs = res.docs as PubDoc[]

  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Публикации</h1>
          <div className="studio-page-head__sub">
            {docs.length > 0 ? `Всего: ${res.totalDocs}` : 'Пока ничего не опубликовано'}
          </div>
        </div>
        <Link href="/studio/posts/new" className="studio-btn studio-btn--primary">
          <Plus size={18} />
          Новая публикация
        </Link>
      </div>

      {docs.length === 0 ? (
        <div className="studio-empty">
          <div className="studio-empty__icon">
            <FileText size={28} />
          </div>
          <div className="studio-empty__title">Здесь появятся ваши публикации</div>
          <div className="studio-empty__text">
            Создайте первую — она сразу окажется в этой ленте.
          </div>
          <Link href="/studio/posts/new" className="studio-btn studio-btn--primary">
            <Plus size={18} />
            Новая публикация
          </Link>
        </div>
      ) : (
        <div className="studio-list">
          {docs.map((doc) => (
            <PostRow key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </>
  )
}
