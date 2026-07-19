import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
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
export async function GET(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const url = new URL(req.url)
  const locParam = url.searchParams.get('location')
  const location: MenuLocation = locParam === 'footer' ? 'footer' : 'header'

  const tenantId = author.tenantId

  try {
    const payload = await getPayload({ config: await config })

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
    return NextResponse.json(
      { error: e?.message || 'Не удалось загрузить меню' },
      { status: 500 },
    )
  }
}
