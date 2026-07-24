import { NextResponse } from 'next/server'
import { withAuthor, apiError } from '@/app/(studio)/studio/api/_lib'
import { buildMenuAdmin } from '@/lib/buildMenuAdmin'
import type { MenuLocation } from '@/lib/buildMenu'

/**
 * Дерево меню для конструктора студии.
 *
 * GET /studio/api/menu?location=header|footer
 * Возвращает:
 *   - tree:  AdminMenuNode[] — «сырое» дерево (со скрытыми узлами и метаданными)
 *   - pages: [{ id, title, slug }] — страницы тенанта (для добавления пунктов)
 *
 * Только чтение. Материализация/правки — отдельными роутами записи.
 */
export const GET = withAuthor(async ({ req, payload, tenantId }) => {
  const url = new URL(req.url)
  const locParam = url.searchParams.get('location')
  const location: MenuLocation = locParam === 'footer' ? 'footer' : 'header'

  try {
    const [tree, pagesRes] = await Promise.all([
      buildMenuAdmin(tenantId, location),
      payload.find({
        collection: 'pages',
        where: { tenant: { equals: tenantId } },
        sort: 'title',
        limit: 200,
        depth: 0,
        overrideAccess: true,
      }),
    ])

    const pages = (pagesRes.docs as any[]).map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
    }))

    return NextResponse.json({ location, tree, pages })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось загрузить меню', 500)
  }
})
