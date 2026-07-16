import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Удаление публикации. Проверяем принадлежность тенанту автора.
 * Body: { id }
 */
export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let data: any
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  const id = data.id
  if (!id) return NextResponse.json({ error: 'Не указана публикация' }, { status: 400 })

  const payload = await getPayload({ config: await config })
  const tenantId = author.tenantId

  const doc: any = await payload
    .findByID({ collection: 'publications', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!doc) return NextResponse.json({ error: 'Публикация не найдена' }, { status: 404 })
  const postTenant = doc.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc.tenant
  if (Number(postTenant) !== Number(tenantId)) {
    return NextResponse.json({ error: 'Публикация не найдена' }, { status: 404 })
  }

  try {
    await payload.delete({ collection: 'publications', id, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось удалить' },
      { status: 400 },
    )
  }
}
