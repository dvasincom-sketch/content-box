import { withAuthor, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { streamSignToken } from '@/lib/cfStream'
import { signPlaybackToken } from '@/lib/videoJwt'
import { presignGet } from '@/lib/s3'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Данные для просмотра видео АВТОРОМ в студии (превью). Автор всегда имеет
 * доступ к видео своего тенанта — проверки подписки нет, только тенант.
 *
 * Ветвление по провайдеру:
 *   - stream:    signed-токен CF + customerCode
 *   - kinescope: provider + embedId (без токена)
 *
 * GET ?id=<videoDocId>
 * Ответ:
 *   stream    → { ok, provider:'stream', token, uid, customerCode }
 *   kinescope → { ok, provider:'kinescope', embedId }
 */
export const runtime = 'nodejs'

export const GET = withAuthor(async ({ req, payload, tenantId }) => {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return apiError('Не указан id')

  let doc: any
  try {
    doc = await payload.findByID({ collection: 'videos', id, depth: 0, overrideAccess: true })
  } catch {
    return apiError('Видео не найдено', 404)
  }

  const docTenant = doc?.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc?.tenant
  if (Number(docTenant) !== Number(tenantId)) {
    return apiError('Нет доступа', 403)
  }

  // Внешняя вставка: файла в хранилище нет, играем по сохранённому адресу.
  if (doc.provider === 'embed') {
    const src = String(doc.embedSrc || '')
    if (!src.startsWith('https://')) return apiError('У видео нет корректной ссылки')
    return apiOk({ provider: 'embed', src, aspect: doc.embedAspect === '9:16' ? '9:16' : '16:9' })
  }

  // Своё хранилище (HLS, Timeweb S3). Автор всегда имеет доступ к своему
  // видео — подписки не проверяем, подписываем master краткоживущим токеном
  // (тем же механизмом, что и публичный плеер). Без этой ветки self-видео
  // проваливалось в ветку Cloudflare без videoRef → «Не удалось собрать плеер».
  if (doc.provider === 'self') {
    const playbackId = String(doc.playbackId || '')
    if (!playbackId || doc.assetStatus !== 'ready') {
      return apiOk({ provider: 'self', status: doc.assetStatus || 'processing' })
    }
    const token = signPlaybackToken(playbackId, 2 * 60 * 60)
    let poster: string | null = null
    if (doc.posterKey) poster = await presignGet(String(doc.posterKey), 2 * 60 * 60).catch(() => null)
    const sprite = doc.spriteKey
      ? `/api/video-sprite/${playbackId}/storyboard.vtt?t=${encodeURIComponent(token)}`
      : null
    const subsRaw = Array.isArray(doc.subtitles) ? (doc.subtitles as any[]) : []
    const subtitles = subsRaw
      .filter((sx) => sx && sx.lang)
      .map((sx) => ({
        lang: String(sx.lang),
        label: String(sx.label || sx.lang),
        url: `/api/video-subtitle/${playbackId}/${encodeURIComponent(String(sx.lang))}?t=${encodeURIComponent(token)}`,
      }))
    const chaptersRaw = Array.isArray(doc.chapters) ? (doc.chapters as any[]) : []
    const chapters = chaptersRaw
      .filter((c) => c && typeof c.start === 'number')
      .map((c) => ({ start: Number(c.start), title: String(c.title || '') }))
      .sort((a, b) => a.start - b.start)
    return apiOk({
      provider: 'self',
      status: 'ready',
      master: `/api/hls/${playbackId}/master.m3u8?t=${encodeURIComponent(token)}`,
      poster,
      sprite,
      subtitles,
      chapters,
    })
  }

  const ref = doc.videoRef
  if (!ref) return apiError('У видео нет привязки к хранилищу')

  const provider = doc.provider === 'kinescope' ? 'kinescope' : 'stream'

  // Kinescope: токен не нужен.
  if (provider === 'kinescope') {
    return apiOk({ provider: 'kinescope', embedId: ref })
  }

  // Cloudflare Stream: signed-токен.
  try {
    const token = await streamSignToken(ref, 2 * 60 * 60) // 2 часа
    return apiOk({
      provider: 'stream',
      token,
      uid: ref,
      customerCode: process.env.CF_STREAM_CUSTOMER_CODE || null,
    })
  } catch (e: unknown) {
    return apiError(`Не удалось подписать токен: ${errorMessage(e, 'ошибка')}`, 500)
  }
})
