import { withAuthor, readJson, apiError, apiOk, canMutateDoc } from '@/app/(studio)/studio/api/_lib'
import { putObject, deleteObject } from '@/lib/s3'
import { enqueueSubtitleJob } from '@/lib/videoJobs'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Управление дорожками субтитров своего видео (provider='self').
 *
 * Body:
 *   add:    { videoId, action?:'add', lang, label?, content }  content — текст VTT/SRT
 *   remove: { videoId, action:'remove', lang }
 *
 * Файлы крошечные, поэтому льём текст ЧЕРЕЗ приложение (не presigned) — заодно
 * конвертируем SRT→VTT (браузерный <track> понимает только VTT). Ключ в S3:
 * subs/{playbackId}/{lang}.vtt. Список дорожек хранится в videos.subtitles (json).
 */
export const runtime = 'nodejs'

const LANG_RE = /^[a-z]{2,3}(-[a-z]{2,4})?$/

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const videoId = data.videoId
  if (!(await canMutateDoc(payload, 'videos', videoId, author, 'videos', 'edit'))) return apiError('Недостаточно прав', 403)

  const video: any = await payload
    .findByID({ collection: 'videos', id: videoId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!video) return apiError('Видео не найдено', 404)
  const vTenant = video.tenant && typeof video.tenant === 'object' ? video.tenant.id : video.tenant
  if (Number(vTenant) !== Number(tenantId)) return apiError('Видео не найдено', 404)
  if (video.provider !== 'self') return apiError('Субтитры доступны только для своего видео')
  const pid = String(video.playbackId || '')
  if (!pid) return apiError('Видео ещё обрабатывается — субтитры можно добавить позже')

  const current: Array<{ lang: string; label: string; key: string }> = Array.isArray(video.subtitles)
    ? (video.subtitles as any[]).filter((s) => s && s.lang).map((s) => ({ lang: String(s.lang), label: String(s.label || s.lang), key: String(s.key || '') }))
    : []

  const action = String(data.action || 'add')

  try {
    // On-demand генерация субтитров+глав через whisper (аудио из HLS).
    if (action === 'generate') {
      await enqueueSubtitleJob(payload, { videoId, tenantId, playbackId: pid })
      return apiOk({ queued: true })
    }

    if (action === 'remove') {
      const lang = String(data.lang || '')
      if (!lang) return apiError('Не указан язык')
      await deleteObject(`subs/${pid}/${lang}.vtt`).catch(() => {})
      const next = current.filter((s) => s.lang !== lang)
      await payload.update({ collection: 'videos', id: videoId, data: { subtitles: next } as any, overrideAccess: true })
      return apiOk({ subtitles: next })
    }

    // add / replace
    const lang = String(data.lang || '').trim().toLowerCase()
    if (!LANG_RE.test(lang)) return apiError('Некорректный код языка (например ru, en, pt-br)')
    const label = String(data.label || '').trim().slice(0, 40) || lang.toUpperCase()
    let content = String(data.content || '')
    if (!content.trim()) return apiError('Пустой файл субтитров')
    if (content.length > 2 * 1024 * 1024) return apiError('Файл субтитров больше 2 МБ')

    // SRT (или без заголовка) → VTT: добавляем заголовок и меняем запятые в
    // таймкодах на точки (00:00:01,000 → 00:00:01.000).
    if (!content.trimStart().startsWith('WEBVTT')) {
      content = 'WEBVTT\n\n' + content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    }

    const key = `subs/${pid}/${lang}.vtt`
    await putObject(key, content, 'text/vtt; charset=utf-8')
    const next = [...current.filter((s) => s.lang !== lang), { lang, label, key }]
    await payload.update({ collection: 'videos', id: videoId, data: { subtitles: next } as any, overrideAccess: true })
    return apiOk({ subtitles: next })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить субтитры'), 500)
  }
})
