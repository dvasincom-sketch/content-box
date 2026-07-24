import { NextResponse } from 'next/server'
import { withAuthor, apiError } from '@/app/(studio)/studio/api/_lib'
import { lexicalToHtml } from '@/lib/lexical'

/**
 * Загрузка страницы для панели редактирования.
 * GET /studio/api/pages/get?id=123
 * Возвращает { id, title, contentHtml } — content разворачивается из Lexical
 * в HTML для RichEditor.
 */
export const GET = withAuthor(async ({ req, payload, tenantId }) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return apiError('Не указана страница')

  try {
    const page = await payload
      .findByID({ collection: 'pages', id, depth: 0, overrideAccess: true })
      .catch(() => null)

    const t = page?.tenant && typeof page.tenant === 'object' ? page.tenant.id : page?.tenant
    if (!page || Number(t) !== Number(tenantId)) {
      return apiError('Страница не найдена', 404)
    }

    return NextResponse.json({
      id: page.id,
      title: page.title,
      contentHtml: lexicalToHtml(page.content),
    })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось загрузить страницу', 500)
  }
})
