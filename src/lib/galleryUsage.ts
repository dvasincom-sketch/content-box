import type { Payload } from 'payload'

/**
 * Единый детектор использований изображений галереи по ОБОИМ хранилищам:
 *
 *  1) Классическое поле `publications.gallery` — join-таблица
 *     `publications_gallery` (image_id → _parent_id публикации). Так галерею
 *     хранят обычные публикации (шаблон 'article').
 *  2) JSON-блоки страниц-профилей — `publications.profile` (jsonb),
 *     blocks[].images[].imageId. Так галерею хранят страницы (шаблон 'profile').
 *
 * Раньше блокировка удаления смотрела только (1) и пропускала (2): можно было
 * удалить фото, которое стоит в блоке страницы, и получить битую ячейку. Этот
 * модуль закрывает дыру и заодно питает счётчик «в N публикациях» и orphan-вид.
 *
 * Возвращает Map<imageId, publicationIds[]> — список РАЗНЫХ публикаций, где
 * изображение встречается. Изображения без записи в Map не используются нигде.
 */
export type GalleryUsageMap = Map<number, number[]>

function getPool(payload: Payload) {
  return (payload.db as unknown as {
    pool?: { query: (text: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }
  }).pool
}

export async function galleryUsageMap(payload: Payload, tenantId: number | string): Promise<GalleryUsageMap> {
  const pool = getPool(payload)
  const sets = new Map<number, Set<number>>()
  const add = (imageId: number, pubId: number) => {
    if (!Number.isFinite(imageId) || !Number.isFinite(pubId)) return
    let s = sets.get(imageId)
    if (!s) { s = new Set(); sets.set(imageId, s) }
    s.add(pubId)
  }
  if (!pool || typeof pool.query !== 'function') return new Map()

  try {
    // (1) классическое поле gallery
    const classic = await pool.query(
      `SELECT pg.image_id AS image_id, pg._parent_id AS pub_id
         FROM publications_gallery pg
         JOIN publications p ON p.id = pg._parent_id
        WHERE p.tenant_id = $1`,
      [tenantId],
    )
    for (const r of classic.rows) add(Number(r.image_id), Number(r.pub_id))

    // (2) JSON-блоки профилей: разворачиваем blocks[].images[].imageId
    const prof = await pool.query(
      `SELECT p.id AS pub_id, (img->>'imageId') AS image_id
         FROM publications p
         CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(p.profile->'blocks') = 'array' THEN p.profile->'blocks' ELSE '[]'::jsonb END
         ) AS blk
         CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(blk->'images') = 'array' THEN blk->'images' ELSE '[]'::jsonb END
         ) AS img
        WHERE p.tenant_id = $1 AND p.profile IS NOT NULL`,
      [tenantId],
    )
    for (const r of prof.rows) add(Number(r.image_id), Number(r.pub_id))
  } catch {
    // При сбое БД возвращаем то, что успели (или пусто) — вызывающий решает.
    // Важно: для блокировки удаления пустая карта означает «не найдено
    // использований», поэтому вызывающий код удаления должен трактовать
    // ошибку детектора консервативно (см. delete route).
  }

  const out: GalleryUsageMap = new Map()
  for (const [iid, s] of sets) out.set(iid, Array.from(s))
  return out
}

/** Использование одного изображения (список id публикаций). */
export async function galleryImageUsage(payload: Payload, tenantId: number | string, imageId: number | string): Promise<number[]> {
  const map = await galleryUsageMap(payload, tenantId)
  return map.get(Number(imageId)) ?? []
}
