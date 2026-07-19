import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Список категорий тенанта для селектов и деревьев в студии.
 * Используется:
 *  - HeroTeamEditPanel (категория-ссылка участника) — читает id/title;
 *  - CategoryMultiPicker / редактор плиток главной — строит дерево по parentId,
 *    показывает обложку (coverUrl).
 *
 * parent добавляет nestedDocsPlugin (поле `parent`, объект|id). cover — upload→media.
 * depth: 1 — чтобы cover пришёл объектом с url.
 *
 * Ответ: { ok, categories: [{ id, title, parentId, coverUrl }] } | { error }
 */

export async function GET() {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await getPayload({ config: await config })

  const res = await payload.find({
    collection: 'categories',
    where: { tenant: { equals: author.tenantId } },
    sort: 'title',
    limit: 200,
    depth: 1,
    overrideAccess: true,
  })

  const categories = (res.docs as any[]).map((c) => {
    const rawParent = c.parent
    const parentId =
      rawParent && typeof rawParent === 'object' ? rawParent.id : (rawParent ?? null)
    const cover = c.cover
    const coverUrl = cover && typeof cover === 'object' ? (cover.url ?? null) : null
    return {
      id: c.id,
      title: c.title ?? '',
      parentId,
      coverUrl,
    }
  })

  return NextResponse.json({ ok: true, categories })
}
