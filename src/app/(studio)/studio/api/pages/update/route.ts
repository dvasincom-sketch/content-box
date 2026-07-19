import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { htmlToLexical } from '@/lib/lexical'

/**
 * Обновление страницы из конструктора меню (панель редактирования).
 * Фокусная правка: заголовок + содержимое (HTML из RichEditor → Lexical).
 * slug/seo здесь не меняются (смена slug ломает ссылки — отдельный сценарий).
 *
 * Body: { id, title?, content? }  (content — HTML-строка из RichEditor)
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
  if (!id) return NextResponse.json({ error: 'Не указана страница' }, { status: 400 })

  const payload = await getPayload({ config: await config })
  const tenantId = author.tenantId

  // Страница принадлежит тенанту?
  const own = await belongsToTenant(payload, 'pages', id, tenantId)
  if (!own) return NextResponse.json({ error: 'Страница не найдена' }, { status: 404 })

  const patch: any = {}

  if (typeof data.title === 'string') {
    const t = data.title.trim()
    if (!t) return NextResponse.json({ error: 'Заголовок не может быть пустым' }, { status: 400 })
    patch.title = t
  }

  // Содержимое: HTML из редактора → Lexical (как у категорий/постов).
  if (typeof data.content === 'string') {
    patch.content = htmlToLexical(data.content)
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Нет изменений' }, { status: 400 })
  }

  try {
    await payload.update({
      collection: 'pages',
      id,
      data: patch,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось сохранить' },
      { status: 400 },
    )
  }
}

async function belongsToTenant(
  payload: any,
  collection: string,
  id: string | number,
  tenantId: number,
): Promise<boolean> {
  try {
    const doc = await payload.findByID({ collection, id, depth: 0, overrideAccess: true })
    const t = doc?.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc?.tenant
    return Number(t) === Number(tenantId)
  } catch {
    return false
  }
}
