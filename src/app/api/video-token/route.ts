import { NextResponse, type NextRequest } from 'next/server'
import { checkVideoAccess } from '@/lib/videoAccess'
import { streamSignToken } from '@/lib/cfStream'

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

  const access = await checkVideoAccess({ id, slug })

  if (!access.allowed) {
    const status = access.reason === 'not-found' ? 404 : 403
    return NextResponse.json(
      { error: 'Нет доступа', reason: access.reason, requiredTierName: access.requiredTierName },
      { status },
    )
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
  } catch (e: any) {
    return NextResponse.json({ error: `Токен: ${e?.message || 'ошибка'}` }, { status: 500 })
  }
}
