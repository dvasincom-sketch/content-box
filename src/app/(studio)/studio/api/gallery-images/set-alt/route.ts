import { withAuthor, apiError, apiOk, belongsToTenant, authorCan } from '../../_lib'

/**
 * Сохранить alt-подписи для фото галереи (после правки автором предложений Аси).
 * Файлы не трогаем — меняем только поле alt.
 *  POST { items: [{ id, alt }] } → { ok, saved }
 */
export const runtime = 'nodejs'

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (!authorCan(author, 'gallery', 'editAny')) return apiError('Недостаточно прав', 403)
  let data: { items?: unknown } | undefined
  try { data = await req.json() } catch { data = undefined }
  if (data === undefined) return apiError('Некорректный запрос')

  const items = (Array.isArray(data.items) ? data.items : []).slice(0, 60)
  let saved = 0
  for (const it of items) {
    if (!it || typeof it !== 'object') continue
    const o = it as { id?: unknown; alt?: unknown }
    const id = String(o.id ?? '').trim()
    const alt = String(o.alt ?? '').trim().slice(0, 200)
    if (!id) continue
    if (!(await belongsToTenant(payload, 'gallery-images', id, tenantId))) continue
    try {
      await payload.update({ collection: 'gallery-images', id, data: { alt } as Record<string, unknown>, overrideAccess: true })
      saved++
    } catch { /* пропускаем */ }
  }
  return apiOk({ saved })
})
