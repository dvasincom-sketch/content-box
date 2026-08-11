import React from 'react'
import Link from 'next/link'
import { Plus, FileText, SearchX } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { requireAuthor, contributorOwnerFilter } from '@/lib/currentAuthor'
import { can } from '@/access'
import { PostRow } from './PostRow'
import { PostsToolbar } from './PostsToolbar'
import { ListPagination } from '@/components/ListPagination'

/**
 * Лента публикаций автора. Список постов ТОЛЬКО своего тенанта (тенант из
 * сессии автора, не из заголовка). Сверху — фильтры (поиск по названию,
 * категория в иерархии, сортировка новые/старые по добавлению), снизу —
 * пагинация с размером страницы 25/50/100.
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
  minTier?: any
}

const PER = [25, 50, 100]

// Категории тенанта → плоский список с глубиной (для иерархичного селекта).
function buildCategoryOptions(cats: any[]): { id: string; label: string; depth: number }[] {
  const byParent = new Map<string, any[]>()
  for (const c of cats) {
    const p = c.parent == null ? 'root' : String(typeof c.parent === 'object' ? c.parent.id : c.parent)
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p)!.push(c)
  }
  for (const arr of byParent.values()) arr.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ru'))
  const out: { id: string; label: string; depth: number }[] = []
  const walk = (pid: string, depth: number) => {
    for (const c of byParent.get(pid) || []) {
      out.push({ id: String(c.id), label: String(c.title || '—'), depth })
      walk(String(c.id), depth + 1)
    }
  }
  walk('root', 0)
  return out
}

export default async function StudioPostsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const q = typeof sp?.q === 'string' ? sp.q.trim().slice(0, 100) : ''
  const categoryId = typeof sp?.category === 'string' ? sp.category : ''
  const sort: 'new' | 'old' = String(sp?.sort || '') === 'old' ? 'old' : 'new'
  const per = PER.includes(Number(sp?.per)) ? Number(sp?.per) : 25
  const page = Math.max(1, Number(sp?.page) || 1)

  const author = await requireAuthor()
  const canCreatePost = can(author!.user as any, 'posts', 'create')
  const ownFilter = contributorOwnerFilter(author!, 'posts')
  const payload = await getPayload({ config: await config })

  // Категории для фильтра (иерархия).
  const catsRes = await payload.find({
    collection: 'categories',
    where: { tenant: { equals: author!.tenantId } },
    sort: 'title',
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  const categoryOptions = buildCategoryOptions(catsRes.docs as any[])

  const and: any[] = [{ tenant: { equals: author!.tenantId } }, ...(ownFilter ? [ownFilter] : [])]
  if (q) and.push({ title: { like: q } })
  if (categoryId) and.push({ or: [{ category: { equals: categoryId } }, { categories: { in: [categoryId] } }] })

  const res = await payload.find({
    collection: 'publications',
    where: { and },
    sort: sort === 'old' ? 'createdAt' : '-createdAt',
    limit: per,
    page,
    depth: 1,
    overrideAccess: true,
  })

  const docs = res.docs as PubDoc[]
  const total = res.totalDocs || docs.length
  const totalPages = res.totalPages || 1
  const hasFilters = Boolean(q || categoryId)

  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Публикации</h1>
          <div className="studio-page-head__sub">
            {total > 0 ? `Всего: ${total}` : hasFilters ? 'По фильтрам ничего не найдено' : 'Пока ничего не опубликовано'}
          </div>
        </div>
        {canCreatePost && (
          <Link href="/studio/posts/new" className="studio-btn studio-btn--primary">
            <Plus size={18} />
            Новая публикация
          </Link>
        )}
      </div>

      <PostsToolbar q={q} categoryId={categoryId} sort={sort} categories={categoryOptions} />

      {docs.length === 0 ? (
        hasFilters ? (
          <div className="studio-empty">
            <div className="studio-empty__icon"><SearchX size={28} /></div>
            <div className="studio-empty__title">Ничего не найдено</div>
            <div className="studio-empty__text">Измените запрос, категорию или сбросьте фильтры.</div>
          </div>
        ) : (
          <div className="studio-empty">
            <div className="studio-empty__icon"><FileText size={28} /></div>
            <div className="studio-empty__title">Здесь появятся ваши публикации</div>
            <div className="studio-empty__text">Создайте первую — она сразу окажется в этой ленте.</div>
            {canCreatePost && (
              <Link href="/studio/posts/new" className="studio-btn studio-btn--primary">
                <Plus size={18} />
                Новая публикация
              </Link>
            )}
          </div>
        )
      ) : (
        <>
          <div className="studio-list">
            {docs.map((doc) => (
              <PostRow key={doc.id} doc={doc} />
            ))}
          </div>
          <ListPagination
            page={page}
            totalPages={totalPages}
            per={per}
            total={total}
            basePath="/studio/posts"
            tone="studio"
            query={{ q: q || undefined, category: categoryId || undefined, sort: sort === 'old' ? 'old' : undefined }}
          />
        </>
      )}
    </>
  )
}
