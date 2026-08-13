import { withAuthor, readJson, apiError, apiOk, canMutateDoc } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'
import { snapshotOf } from '@/app/(studio)/studio/api/update-post/route'

/**
 * Откат публикации на предыдущую сохранённую версию (снимок в поле prevVersion).
 * Храним ровно ОДИН прошлый снимок. Восстановление — обратимый «шаг назад»:
 * текущее состояние уходит в prevVersion, а снимок становится текущим.
 * Повторный вызов вернёт всё обратно (одноуровневое undo/redo).
 *
 * Body: { id }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const id = data.id
  if (!id) return apiError('Не указана публикация')
  if (!(await canMutateDoc(payload, 'publications', id, author, 'posts', 'edit'))) return apiError('Недостаточно прав', 403)

  const existing: any = await payload
    .findByID({ collection: 'publications', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!existing) return apiError('Публикация не найдена', 404)
  const postTenant =
    existing.tenant && typeof existing.tenant === 'object' ? existing.tenant.id : existing.tenant
  if (Number(postTenant) !== Number(tenantId)) return apiError('Публикация не найдена', 404)

  const snap = existing.prevVersion
  if (!snap || typeof snap !== 'object') return apiError('Нет предыдущей версии для восстановления', 400)

  const patch = patchFromSnapshot(snap)
  // Текущее состояние сохраняем как «предыдущее» — чтобы откат был обратимым.
  patch.prevVersion = snapshotOf(existing)

  try {
    await payload.update({ collection: 'publications', id, data: patch, overrideAccess: true })
    return apiOk({ restoredFrom: typeof snap.savedAt === 'string' ? snap.savedAt : null })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось восстановить'))
  }
})

/** id из number | {id} | null. */
function relId(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'object') {
    const raw = (v as { id?: unknown }).id
    return raw == null ? null : Number(raw)
  }
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** массив id из массива (number | {id}). */
function relIds(v: unknown): number[] {
  if (!Array.isArray(v)) return []
  return v.map(relId).filter((x): x is number => x != null)
}

/**
 * Из снимка (значения полей на момент прошлого сохранения, depth:0) строит
 * patch для payload.update. Реляции приводим к id, у строк галереи и тегов
 * срезаем внутренние row-id, чтобы Payload пересоздал строки заново.
 */
function patchFromSnapshot(snap: any): Record<string, unknown> {
  const p: Record<string, unknown> = {}
  if (typeof snap.title === 'string') p.title = snap.title
  if ('description' in snap) p.description = snap.description ?? null
  if ('profile' in snap) p.profile = snap.profile && typeof snap.profile === 'object' && !Array.isArray(snap.profile) ? snap.profile : null
  if ('template' in snap) p.template = snap.template === 'profile' ? 'profile' : 'article'
  if ('cover' in snap) p.cover = relId(snap.cover)
  if ('category' in snap) p.category = relId(snap.category)
  if ('extraCategories' in snap) p.extraCategories = relIds(snap.extraCategories)
  if ('minTier' in snap) p.minTier = relId(snap.minTier)
  if ('relatedVideos' in snap) p.relatedVideos = relIds(snap.relatedVideos)
  if ('gallery' in snap) {
    p.gallery = Array.isArray(snap.gallery)
      ? snap.gallery
          .map((r: any) => {
            const image = relId(r?.image)
            if (image == null) return null
            const caption = typeof r?.caption === 'string' ? r.caption.trim() : ''
            return caption ? { image, caption } : { image }
          })
          .filter(Boolean)
      : []
  }
  if ('tags' in snap) {
    p.tags = Array.isArray(snap.tags)
      ? snap.tags
          .map((t: any) => (typeof t?.label === 'string' && t.label.trim() ? { label: t.label.trim() } : null))
          .filter(Boolean)
      : []
  }
  if ('isNews' in snap) p.isNews = Boolean(snap.isNews)
  if ('isNew' in snap) p.isNew = Boolean(snap.isNew)
  if ('eventDate' in snap) p.eventDate = snap.eventDate ?? null
  if ('publishedAt' in snap) p.publishedAt = snap.publishedAt ?? null
  return p
}
