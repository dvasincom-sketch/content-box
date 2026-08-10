import { withAuthor, readJson, apiOk, apiError, canMutateDoc } from '@/app/(studio)/studio/api/_lib'

/**
 * Ручное сохранение глав своего видео из студии (правка авто-глав). Автор
 * (владелец) не гейтится. Нормализуем: тайминги — целые ≥0, сортировка по
 * времени, первая глава = 0, заголовки тримятся/режутся, пустые отбрасываются.
 * Body: { videoId, chapters: [{ start:number, title:string }] } → { ok, chapters }
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
  if (video.provider !== 'self') return apiError('Только для своего видео')

  const raw = Array.isArray(data.chapters) ? data.chapters : []
  let chapters = raw
    .map((c: any) => ({ start: Math.max(0, Math.floor(Number(c?.start))), title: String(c?.title ?? '').trim().slice(0, 120) }))
    .filter((c: any) => Number.isFinite(c.start) && c.title.length > 0)
    .sort((a: any, b: any) => a.start - b.start)
    .slice(0, 60)
  // Первая глава всегда с нуля — иначе плеер до неё «без главы».
  if (chapters.length) chapters[0] = { ...chapters[0], start: 0 }

  await payload.update({ collection: 'videos', id: videoId, data: { chapters: chapters.length ? chapters : null } as any, overrideAccess: true })
  return apiOk({ chapters })
})
