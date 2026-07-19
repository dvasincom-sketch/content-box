import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Обновление РУЧНОГО пункта меню (kind='page' | 'url').
 *
 * Переименование авто-категорий делает menu/upsert (labelOverride) — здесь
 * оверрайды категорий отклоняются. kind/parent/order здесь не меняются
 * (kind — пересоздать; parent/order — задача menu/reorder).
 *
 * Body: { id, labelOverride?, url?, pageId?, hidden? }
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
  if (!id) return NextResponse.json({ error: 'Не указан пункт' }, { status: 400 })

  const payload = await getPayload({ config: await config })
  const tenantId = author.tenantId

  // Пункт существует и принадлежит тенанту?
  const item = await payload
    .findByID({ collection: 'menu-items', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  const t = item?.tenant && typeof item.tenant === 'object' ? item.tenant.id : item?.tenant
  if (!item || Number(t) !== Number(tenantId)) {
    return NextResponse.json({ error: 'Пункт не найден' }, { status: 404 })
  }

  // Оверрайды авто-категорий здесь не редактируются.
  if (item.kind === 'category') {
    return NextResponse.json(
      { error: 'Категории переименовываются через отдельную операцию' },
      { status: 400 },
    )
  }

  const patch: any = {}

  if ('hidden' in data) patch.hidden = Boolean(data.hidden)

  if ('labelOverride' in data) {
    const l = typeof data.labelOverride === 'string' ? data.labelOverride.trim() : ''
    if (item.kind === 'url' && !l) {
      return NextResponse.json(
        { error: 'Для внешней ссылки название обязательно' },
        { status: 400 },
      )
    }
    patch.labelOverride = l || null // для page пусто → имя страницы
  }

  if (item.kind === 'url' && 'url' in data) {
    const u = typeof data.url === 'string' ? data.url.trim() : ''
    if (!u) return NextResponse.json({ error: 'Не указан URL' }, { status: 400 })
    patch.url = u
  }

  if (item.kind === 'page' && 'pageId' in data) {
    if (data.pageId == null) {
      return NextResponse.json({ error: 'Не указана страница' }, { status: 400 })
    }
    const pageOk = await belongsToTenant(payload, 'pages', data.pageId, tenantId)
    if (!pageOk) return NextResponse.json({ error: 'Страница не найдена' }, { status: 404 })
    patch.page = Number(data.pageId)
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Нет изменений' }, { status: 400 })
  }

  try {
    await payload.update({
      collection: 'menu-items',
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
