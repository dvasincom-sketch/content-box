import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { plainTextToLexical } from '@/lib/lexical'
import { slugify } from '@/lib/slugify'

/**
 * Обновление публикации. Проверяем, что пост принадлежит тенанту автора.
 * Статус меняется через publish:
 *   - publish=true  → publishedAt = now (если ещё не был опубликован)
 *   - publish=false → publishedAt = null (снять с публикации → черновик)
 *   - publish не передан → publishedAt не трогаем
 *
 * Body: { id, title, body, coverId?, categoryId?, minTierId?, publish? }
 * Значения coverId/categoryId/minTierId:
 *   - число  → установить
 *   - null   → очистить поле
 *   - undefined/отсутствует → не трогать
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

  // Пост принадлежит тенанту?
  const existing: any = await payload
    .findByID({ collection: 'publications', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!existing) return NextResponse.json({ error: 'Публикация не найдена' }, { status: 404 })
  const postTenant =
    existing.tenant && typeof existing.tenant === 'object' ? existing.tenant.id : existing.tenant
  if (Number(postTenant) !== Number(tenantId)) {
    return NextResponse.json({ error: 'Публикация не найдена' }, { status: 404 })
  }

  const patch: any = {}

  if (typeof data.title === 'string') {
    const title = data.title.trim()
    if (!title) return NextResponse.json({ error: 'Укажите заголовок' }, { status: 400 })
    patch.title = title
    // slug не трогаем автоматически при редактировании — он уже есть и может быть в ссылках
  }

  if (typeof data.body === 'string') {
    patch.description = plainTextToLexical(data.body)
  }

  // Связи: null очищает, число ставит (с проверкой тенанта), undefined пропускает
  if ('categoryId' in data) {
    patch.category = await resolveRel(payload, 'categories', data.categoryId, tenantId)
  }
  if ('minTierId' in data) {
    patch.minTier = await resolveRel(payload, 'subscription-tiers', data.minTierId, tenantId)
  }
  if ('coverId' in data) {
    patch.cover = await resolveRel(payload, 'media', data.coverId, tenantId)
  }

  // Статус
  if (data.publish === true) {
    // публикуем: ставим дату, если её не было
    if (!existing.publishedAt) patch.publishedAt = new Date().toISOString()
  } else if (data.publish === false) {
    // снимаем с публикации → черновик
    patch.publishedAt = null
  }

  try {
    await payload.update({
      collection: 'publications',
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

/**
 * null → null (очистить); число → проверить тенант, вернуть число или null;
 * прочее → null.
 */
async function resolveRel(
  payload: any,
  collection: string,
  value: any,
  tenantId: number,
): Promise<number | null> {
  if (value == null) return null
  try {
    const doc = await payload.findByID({ collection, id: value, depth: 0, overrideAccess: true })
    const t = doc?.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc?.tenant
    return Number(t) === Number(tenantId) ? Number(value) : null
  } catch {
    return null
  }
}
