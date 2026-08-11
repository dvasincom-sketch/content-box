import { withAuthor, readJson, apiOk, apiError, canMutateDoc } from '@/app/(studio)/studio/api/_lib'

/**
 * Ручное редактирование саммари в студии. Автор правит краткое содержание от Аси
 * (tldr + пункты) — сохраняем как есть и помечаем edited:true, чтобы отличать от
 * авто-генерации. Правки автора имеют приоритет: авто-перегенерация делается
 * только по явному «Обновить саммари».
 * Body: { videoId, tldr, points } → { ok, summary }
 */
export const runtime = 'nodejs'

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const videoId = data.videoId
  if (!(await canMutateDoc(payload, 'videos', videoId, author, 'videos', 'edit'))) return apiError('Недостаточно прав', 403)

  const video: any = await payload.findByID({ collection: 'videos', id: videoId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!video) return apiError('Видео не найдено', 404)
  const vt = video.tenant && typeof video.tenant === 'object' ? video.tenant.id : video.tenant
  if (Number(vt) !== Number(tenantId)) return apiError('Видео не найдено', 404)

  const tldr = String(data.tldr || '').trim().slice(0, 1200)
  const points = Array.isArray(data.points)
    ? data.points.map((p: unknown) => String(p || '').trim()).filter((p: string) => p.length > 0).slice(0, 12)
    : []
  if (!tldr && !points.length) return apiError('Пустое саммари')

  const prev = (video.summary && typeof video.summary === 'object') ? video.summary : {}
  const text = [tldr, ...points.map((p: string) => `• ${p}`)].filter(Boolean).join('\n')
  const summary = {
    ...prev,
    tldr,
    points,
    text,
    lang: prev.lang || 'ru',
    edited: true,
    at: new Date().toISOString(),
  }
  await payload.update({ collection: 'videos', id: videoId, data: { summary } as any, overrideAccess: true })
  return apiOk({ summary })
})
