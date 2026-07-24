import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Удаление записи menu-items с каскадом по ручным потомкам.
 *
 * Принимает ЛИБО { id } (id записи menu-items), ЛИБО { key } в форме
 * 'item:<menuItemId>' | 'cat:<categoryId>'.
 *
 * Режимы:
 *  - Ручной пункт (item) → удаляется вместе с поддеревом ручных детей.
 *  - Оверрайд категории (cat) → удаляется запись оверрайда (узел возвращается
 *    в чистый автоген); прицепленные к нему ручные дети уходят каскадом.
 *  - cat без материализованного оверрайда → удалять нечего: { ok, deleted: 0 }.
 *
 * Каскад: собираем поддерево и удаляем снизу вверх (листья раньше родителя),
 * чтобы FK parent не упёрся в живого родителя.
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  // --- Определяем целевую запись menu-items ----------------------------------

  let targetId: number | null = null

  if (data.id != null) {
    targetId = Number(data.id)
  } else if (typeof data.key === 'string') {
    const [type, raw] = data.key.split(':')
    const num = Number(raw)
    if (!Number.isFinite(num)) {
      return apiError('Некорректный ключ')
    }
    if (type === 'item') {
      targetId = num
    } else if (type === 'cat') {
      // Ищем материализованный оверрайд этой категории (в любом location тенанта).
      const ov = await payload.find({
        collection: 'menu-items',
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { kind: { equals: 'category' } },
            { category: { equals: num } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const found = ov.docs[0] as any
      if (!found) {
        // Чистый автоген — удалять нечего.
        return apiOk({ deleted: 0 })
      }
      targetId = found.id
    } else {
      return apiError('Некорректный ключ')
    }
  } else {
    return apiError('Не указан пункт')
  }

  if (targetId == null || !Number.isFinite(targetId)) {
    return apiError('Не указан пункт')
  }

  // --- Проверка принадлежности тенанту ---------------------------------------

  const target = await payload
    .findByID({ collection: 'menu-items', id: targetId, depth: 0, overrideAccess: true })
    .catch(() => null)
  const t = target?.tenant && typeof target.tenant === 'object' ? target.tenant.id : target?.tenant
  if (!target || Number(t) !== Number(tenantId)) {
    return apiError('Пункт не найден', 404)
  }

  // --- Сбор поддерева ручных потомков (BFS вниз по parent) -------------------

  // Все menu-items тенанта того же location — для обхода детей в памяти.
  const allRes = await payload.find({
    collection: 'menu-items',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { location: { equals: target.location } },
      ],
    },
    limit: 2000,
    depth: 0,
    overrideAccess: true,
  })
  const all = allRes.docs as any[]

  const parentIdOf = (doc: any): number | null => {
    const p = doc.parent && typeof doc.parent === 'object' ? doc.parent.id : doc.parent
    return p != null ? Number(p) : null
  }
  const childrenByParent = new Map<number, any[]>()
  for (const d of all) {
    const pid = parentIdOf(d)
    if (pid == null) continue
    const bucket = childrenByParent.get(pid) ?? []
    bucket.push(d)
    childrenByParent.set(pid, bucket)
  }

  // Порядок удаления: сначала листья, потом выше. Собираем post-order.
  const ordered: number[] = []
  const visit = (id: number, guard: number) => {
    if (guard > 5000) return
    for (const child of childrenByParent.get(id) ?? []) {
      visit(child.id, guard + 1)
    }
    ordered.push(id) // ребёнок добавляется раньше родителя
  }
  visit(Number(targetId), 0)

  // --- Удаление снизу вверх --------------------------------------------------

  try {
    let deleted = 0
    for (const id of ordered) {
      await payload.delete({ collection: 'menu-items', id, overrideAccess: true })
      deleted += 1
    }
    return apiOk({ deleted })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось удалить')
  }
})
