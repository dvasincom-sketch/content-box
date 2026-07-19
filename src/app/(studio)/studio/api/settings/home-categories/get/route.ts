import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Чтение выбранных категорий-плиток (homeCategories) для редактора секции
 * «Категории» в студии. SiteSettings — одна запись на тенант. Возвращаем
 * выбранные категории В ТЕКУЩЕМ ПОРЯДКЕ (порядок = порядок массива relationship)
 * с id/title/coverUrl для превью в верхнем dnd-списке панели.
 *
 * depth: 1 — чтобы элементы homeCategories пришли объектами (id/title/cover).
 * Полный список всех категорий (для дерева+поиска) панель берёт отдельно из
 * /studio/api/settings/categories-list.
 *
 * Ответ: { ok, selected: [{ id, title, coverUrl }] } | { error }
 */

export async function GET() {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await getPayload({ config: await config })

  const res = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: author.tenantId } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const settings = res.docs[0] as any
  if (!settings) {
    return NextResponse.json({ error: 'Настройки сайта не найдены' }, { status: 404 })
  }

  const raw = Array.isArray(settings.homeCategories) ? settings.homeCategories : []
  const selected = raw
    // отсеиваем «висячие» связи (id без объекта / удалённые категории)
    .filter((c: any) => c && typeof c === 'object')
    .map((c: any) => {
      const cover = c.cover
      const coverUrl = cover && typeof cover === 'object' ? (cover.url ?? null) : null
      return { id: c.id, title: c.title ?? '', coverUrl }
    })

  return NextResponse.json({ ok: true, selected })
}
