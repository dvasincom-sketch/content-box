import { withAuthor, readJson, apiOk, apiError, canMutateDoc } from '@/app/(studio)/studio/api/_lib'
import { getObjectText } from '@/lib/s3'
import { asyaEnabled, polishChapters, chapterSegments, type Chapter } from '@/lib/asya'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Полировка заголовков авто-глав через Асю. Автор (владелец контента) не гейтится
 * по тарифу. Берём текущие главы (videos.chapters) и субтитры (VTT из S3), режем
 * речь по границам глав, отдаём Асе — она возвращает короткие заголовки. Тайминги
 * (start) не трогаем, меняем только title. Пустой заголовок от Аси = оставить старый.
 * Body: { videoId } → { ok, chapters }
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
  if (!asyaEnabled()) return apiError('Недоступно: не задан ключ Аси', 503)

  const chapters: Chapter[] = Array.isArray(video.chapters)
    ? video.chapters.map((c: any) => ({ start: Number(c?.start) || 0, title: String(c?.title || '') }))
    : []
  if (chapters.length < 2) return apiError('Нет глав для полировки — сначала сгенерируйте субтитры и главы')

  const subs: any[] = Array.isArray(video.subtitles) ? video.subtitles : []
  const track = subs.find((s) => s?.key && String(s.lang) === 'ru') || subs.find((s) => s?.key)
  if (!track) return apiError('Нет субтитров — сначала сгенерируйте субтитры')

  try {
    const vtt = await getObjectText(String(track.key))
    if (!vtt) return apiError('Не удалось прочитать субтитры', 500)
    const segments = chapterSegments(vtt, chapters)
    const titles = await polishChapters({ segments, title: String(video.title || ''), lang: String(track.lang || 'ru') })
    // Пустой заголовок от Аси → оставляем прежний.
    const next: Chapter[] = chapters.map((c, i) => ({ start: c.start, title: (titles[i] || '').trim() || c.title }))
    await payload.update({ collection: 'videos', id: videoId, data: { chapters: next } as any, overrideAccess: true })
    return apiOk({ chapters: next })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось улучшить главы'), 500)
  }
})
