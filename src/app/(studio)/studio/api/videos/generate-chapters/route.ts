import { withAuthor, readJson, apiOk, apiError, canMutateDoc } from '@/app/(studio)/studio/api/_lib'
import { getObjectText } from '@/lib/s3'
import { asyaEnabled, buildChapters, vttToCues, pushVideoKnowledge } from '@/lib/asya'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Построение глав «с нуля» через Асю. В отличие от polish-chapters (только
 * переименование готовых сегментов), здесь Ася сама решает границы глав по
 * полной расшифровке с таймкодами и возвращает [{ start, title }]. Автор —
 * владелец контента, по тарифу не гейтится.
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

  const subs: any[] = Array.isArray(video.subtitles) ? video.subtitles : []
  const track = subs.find((s) => s?.key && String(s.lang) === 'ru') || subs.find((s) => s?.key)
  if (!track) return apiError('Нет субтитров — сначала сгенерируйте субтитры')

  try {
    const vtt = await getObjectText(String(track.key))
    if (!vtt) return apiError('Не удалось прочитать субтитры', 500)
    const cues = vttToCues(vtt)
    if (cues.length < 4) return apiError('Слишком короткая расшифровка для глав')
    const chapters = await buildChapters({ cues, title: String(video.title || ''), lang: String(track.lang || 'ru') })
    if (chapters.length < 2) return apiError('Ася не смогла собрать главы — попробуйте ещё раз')
    await payload.update({ collection: 'videos', id: videoId, data: { chapters } as any, overrideAccess: true })

    // Пополняем знание Аси главами с таймкодами (best-effort).
    const url = video.slug ? `/video/${video.slug}` : undefined
    const kSummary = video.summary && typeof video.summary === 'object' ? String((video.summary as any).text || (video.summary as any).tldr || '') : undefined
    await pushVideoKnowledge({ source: `video:${videoId}`, title: String(video.title || ''), url, summary: kSummary, chapters })
    return apiOk({ chapters })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось собрать главы'), 500)
  }
})
