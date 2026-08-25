/**
 * Ручной порядок смешанного содержимого категории (подкатегории + публикации).
 *
 * На категории хранится JSON-массив ссылок `contentOrder: [{k,id}, …]`, где
 * `k:'c'` — подкатегория, `k:'p'` — публикация. Автор задаёт его перетаскиванием
 * в студии; фан-сайт и редактор используют ОДНУ И ТУ ЖЕ функцию слияния, чтобы
 * порядок совпадал: сначала идут сохранённые ссылки (в заданном порядке, но
 * только те, что ещё существуют), затем «хвост» из новых элементов, которых в
 * сохранённом порядке ещё нет — сначала публикации (по дате), потом подкатегории
 * (по полю order). Так свежесозданное содержимое не теряется, а расстановка
 * автора остаётся сверху.
 */

export type ContentKind = 'c' | 'p'
export type ContentRef = { k: ContentKind; id: number }

const keyOf = (r: ContentRef): string => `${r.k}:${r.id}`

/** Разобрать сырое значение из БД/запроса в чистый список ссылок (без дублей). */
export function normalizeContentOrder(raw: unknown): ContentRef[] {
  if (!Array.isArray(raw)) return []
  const out: ContentRef[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const k = (item as any).k
    const idRaw = (item as any).id
    if (k !== 'c' && k !== 'p') continue
    const id = Number(idRaw)
    if (!Number.isFinite(id)) continue
    const ref: ContentRef = { k, id }
    const key = keyOf(ref)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(ref)
  }
  return out
}

/**
 * Итоговый порядок смешанного списка.
 * @param order      сохранённый ручной порядок (сырой или уже нормализованный)
 * @param catIds     id доступных подкатегорий в дефолтном порядке (по 'order')
 * @param pubIds     id доступных публикаций в дефолтном порядке (по дате)
 */
export function mergeContentOrder(opts: {
  order: unknown
  catIds: Array<number | string>
  pubIds: Array<number | string>
}): ContentRef[] {
  const cats = opts.catIds.map((x) => Number(x)).filter((n) => Number.isFinite(n))
  const pubs = opts.pubIds.map((x) => Number(x)).filter((n) => Number.isFinite(n))
  const catSet = new Set(cats)
  const pubSet = new Set(pubs)

  const stored = normalizeContentOrder(opts.order)
  const result: ContentRef[] = []
  const used = new Set<string>()

  // 1) Сохранённый порядок — только для существующих сейчас элементов.
  for (const ref of stored) {
    const exists = ref.k === 'c' ? catSet.has(ref.id) : pubSet.has(ref.id)
    if (!exists) continue
    const key = keyOf(ref)
    if (used.has(key)) continue
    used.add(key)
    result.push(ref)
  }

  // 2) Хвост: новые публикации (в порядке pubIds), затем новые подкатегории.
  for (const id of pubs) {
    const ref: ContentRef = { k: 'p', id }
    if (!used.has(keyOf(ref))) {
      used.add(keyOf(ref))
      result.push(ref)
    }
  }
  for (const id of cats) {
    const ref: ContentRef = { k: 'c', id }
    if (!used.has(keyOf(ref))) {
      used.add(keyOf(ref))
      result.push(ref)
    }
  }

  return result
}
