import { NextResponse, type NextRequest } from 'next/server'
import { checkVideoAccess } from '@/lib/videoAccess'
import { streamSignToken } from '@/lib/cfStream'
import { signPlaybackToken } from '@/lib/videoJwt'
import { presignGet } from '@/lib/s3'
import { tenantIdFromRequestHeaders } from '@/lib/tenantByHost'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Публичный роут выдачи данных для плеера подписчику. Доступ выдаётся ТОЛЬКО
 * если разрешён правилом гейтинга (checkVideoAccess) — иначе 403 с причиной.
 *
 * Ветвление по провайдеру видео:
 *   - stream:    возвращаем signed-токен CF + customerCode (плеер собирает CF-iframe)
 *   - kinescope: возвращаем provider + embedId (плеер собирает kinescope-iframe)
 *
 * GET ?id=<videoId>  или  ?slug=<slug>
 * Ответ:
 *   stream    → { ok, provider:'stream', token, uid, customerCode }
 *   kinescope → { ok, provider:'kinescope', embedId }
 *   нет доступа → { error, reason, requiredTierName }
 */
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || undefined
  const slug = req.nextUrl.searchParams.get('slug') || undefined

  if (!id && !slug) {
    return NextResponse.json({ error: 'Не указан id или slug' }, { status: 400 })
  }

  // Тенант резолвим ПО ХОСТУ запроса: proxy.ts не обрабатывает `/api/*`, так
  // что заголовку x-tenant-id тут доверять нельзя — он пришёл бы от клиента.
  const tenantId = await tenantIdFromRequestHeaders(req.headers)
  if (!tenantId) {
    return NextResponse.json({ error: 'Неизвестный домен' }, { status: 404 })
  }

  const access = await checkVideoAccess({ id, slug, tenantId })

  if (!access.allowed) {
    const status = access.reason === 'not-found' ? 404 : 403
    return NextResponse.json(
      { error: 'Нет доступа', reason: access.reason, requiredTierName: access.requiredTierName },
      { status },
    )
  }

  // Внешняя вставка (VK, Дзен). Проверка доступа выше уже прошла, но защитой
  // она здесь не является: адрес плеера ведёт на чужой домен, значит виден в
  // исходнике страницы и пересылается как обычная ссылка. Для такого видео
  // minTier — мягкий барьер, о чём студия предупреждает при сохранении.
  //
  // Отдаём src, который лежит в базе: он туда попал уже разобранным и с
  // проверенным хостом (src/lib/videoEmbed.ts). Здесь ничего не собираем и не
  // доверяем полю вслепую — на всякий случай сверяем схему ещё раз.
  // Аудио: MP3 в S3. Проверка доступа выше уже прошла; отдаём URL файла.
  // Защита мягкая (публичный S3-URL) — как у embed; для платного контента
  // это барьер доступа к плееру, не к самому файлу по прямой ссылке.
  if (access.video.provider === 'audio') {
    const url = String(access.video.audioSrc || '')
    if (!url.startsWith('http')) {
      return NextResponse.json({ error: 'У аудио нет файла' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, provider: 'audio', audioUrl: url })
  }

  if (access.video.provider === 'embed') {
    const src = String(access.video.embedSrc || '')
    if (!src.startsWith('https://')) {
      return NextResponse.json({ error: 'У видео нет корректной ссылки' }, { status: 400 })
    }
    return NextResponse.json({
      ok: true,
      provider: 'embed',
      src,
      aspect: access.video.embedAspect === '9:16' ? '9:16' : '16:9',
    })
  }

  // Своё хранилище (HLS, Timeweb S3). Доступ уже проверен checkVideoAccess —
  // выдаём краткоживущий JWT, которым подписан master-URL. По нему /api/hls
  // отдаёт плейлисты и редиректит сегменты на presigned S3.
  if (access.video.provider === 'self') {
    const playbackId = String(access.video.playbackId || '')
    if (!playbackId || access.video.assetStatus !== 'ready') {
      return NextResponse.json({ ok: true, provider: 'self', status: access.video.assetStatus || 'processing' })
    }
    const token = signPlaybackToken(playbackId, 2 * 60 * 60)
    let poster: string | null = null
    if (access.video.posterKey) {
      poster = await presignGet(String(access.video.posterKey), 2 * 60 * 60).catch(() => null)
    }
    // Сториборд (scrub-preview): VTT-таблица кадров, подписанная тем же токеном.
    const sprite = access.video.spriteKey
      ? `/api/video-sprite/${playbackId}/storyboard.vtt?t=${encodeURIComponent(token)}`
      : null
    // Дорожки субтитров: подписанные тем же токеном URL VTT (браузерный <track>).
    const subsRaw = Array.isArray(access.video.subtitles) ? (access.video.subtitles as any[]) : []
    const subtitles = subsRaw
      .filter((sx) => sx && sx.lang)
      .map((sx) => ({
        lang: String(sx.lang),
        label: String(sx.label || sx.lang),
        url: `/api/video-subtitle/${playbackId}/${encodeURIComponent(String(sx.lang))}?t=${encodeURIComponent(token)}`,
      }))
    // Динамический watermark: подпись зрителя поверх видео (антипиратство).
    // Показываем email подписчика — если запись утечёт, на ней виден источник.
    const wmEmail = access.subscriber && typeof access.subscriber === 'object'
      ? String((access.subscriber as { email?: unknown }).email || '')
      : ''
    return NextResponse.json({
      ok: true,
      provider: 'self',
      status: 'ready',
      master: `/api/hls/${playbackId}/master.m3u8?t=${encodeURIComponent(token)}`,
      poster,
      watermark: wmEmail || null,
      sprite,
      subtitles,
    })
  }

  const ref = access.video.videoRef
  if (!ref) {
    return NextResponse.json({ error: 'У видео нет привязки к хранилищу' }, { status: 400 })
  }

  const provider = access.video.provider === 'kinescope' ? 'kinescope' : 'stream'

  // Kinescope: токен не нужен, плеер играет по embedId (базовая приватность).
  if (provider === 'kinescope') {
    return NextResponse.json({ ok: true, provider: 'kinescope', embedId: ref })
  }

  // Cloudflare Stream: signed-токен.
  try {
    const token = await streamSignToken(ref, 2 * 60 * 60)
    return NextResponse.json({
      ok: true,
      provider: 'stream',
      token,
      uid: ref,
      customerCode: process.env.CF_STREAM_CUSTOMER_CODE || null,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: `Токен: ${errorMessage(e, 'ошибка')}` }, { status: 500 })
  }
}
