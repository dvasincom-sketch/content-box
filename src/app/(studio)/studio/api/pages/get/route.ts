import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { lexicalToHtml } from '@/lib/lexical'

/**
 * Загрузка страницы для панели редактирования.
 * GET /studio/api/pages/get?id=123
 * Возвращает { id, title, contentHtml } — content разворачивается из Lexical
 * в HTML для RichEditor.
 */
export async function GET(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Не указана страница' }, { status: 400 })

  const payload = await getPayload({ config: await config })
  const tenantId = author.tenantId

  try {
    const page = await payload
      .findByID({ collection: 'pages', id, depth: 0, overrideAccess: true })
      .catch(() => null)

    const t = page?.tenant && typeof page.tenant === 'object' ? page.tenant.id : page?.tenant
    if (!page || Number(t) !== Number(tenantId)) {
      return NextResponse.json({ error: 'Страница не найдена' }, { status: 404 })
    }

    return NextResponse.json({
      id: page.id,
      title: page.title,
      contentHtml: lexicalToHtml(page.content),
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось загрузить страницу' },
      { status: 500 },
    )
  }
}
