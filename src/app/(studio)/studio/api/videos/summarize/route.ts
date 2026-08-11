import { withAuthor, readJson, apiOk, apiError, canMutateDoc } from '@/app/(studio)/studio/api/_lib'
import { getObjectText } from '@/lib/s3'
import { asyaEnabled, summarizeTranscript, vttToPlainText, pushVideoKnowledge } from '@/lib/asya'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Студийная (пере)генерация саммари от Аси для своего видео. Автор не гейтится по
 * тарифу — он владелец контента. refresh=true (игнорируем кэш Аси). Транскрипт —
 * из субтитров видео.
 * Body: { videoId } → { ok, summary }
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
  if (!asyaEnabled()) return apiError('Саммари недоступно: не задан ключ Аси', 503)

  const subs: any[] = Array.isArray(video.subtitles) ? video.subtitles : []
  const track = subs.find((s) => s?.key && String(s.lang) === 'ru') || subs.find((s) => s?.key)
  if (!track) return apiError('Нет субтитров — сначала сгенерируйте субтитры')

  try {
    const vtt = await getObjectText(String(track.key))
    if (!vtt) return apiError('Не удалось прочитать субтитры', 500)
    const transcript = vttToPlainText(vtt)
    if (transcript.length < 30) return apiError('Транскрипт слишком короткий для саммари')

    const r = await summarizeTranscript({ transcript, title: String(video.title || ''), source: `video:${videoId}`, lang: String(track.lang || 'ru'), refresh: true })
    const summary = { tldr: r.tldr, points: r.points, text: r.text, hash: r.hash, lang: r.lang, at: new Date().toISOString() }
    await payload.update({ collection: 'videos', id: videoId, data: { summary } as any, overrideAccess: true })

    // Пополняем знание Аси по видео (для ответов «где посмотреть …»).
    const url = video.slug ? `/video/${video.slug}` : undefined
    const kSummary = [r.tldr, ...(r.points || [])].filter(Boolean).join(' ')
    const kChapters = Array.isArray(video.chapters) ? video.chapters.map((c: any) => ({ start: Number(c?.start) || 0, title: String(c?.title || '') })) : undefined
    await pushVideoKnowledge({ source: `video:${videoId}`, title: String(video.title || ''), url, summary: kSummary, chapters: kChapters })
    return apiOk({ summary })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось обновить саммари'), 500)
  }
})
