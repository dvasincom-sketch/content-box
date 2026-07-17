import { NextResponse, type NextRequest } from 'next/server'
import { checkVideoAccess } from '@/lib/videoAccess'
import { streamSignToken } from '@/lib/cfStream'

/**
 * Публичный роут выдачи signed-токена подписчику. Токен выдаётся ТОЛЬКО если
 * доступ разрешён правилом гейтинга (checkVideoAccess). Иначе — 403 с причиной,
 * и токен не генерируется вовсе (видео физически не открыть).
 *
 * GET ?id=<videoId>  или  ?slug=<slug>
 * Ответ: { token, uid, customerCode } | { error, reason, requiredTierName }
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

  const uid = access.video.videoRef
  if (!uid) {
    return NextResponse.json({ error: 'У видео нет привязки к Stream' }, { status: 400 })
  }

  try {
    const token = await streamSignToken(uid, 2 * 60 * 60)
    return NextResponse.json({
      ok: true,
      token,
      uid,
      customerCode: process.env.CF_STREAM_CUSTOMER_CODE || null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: `Токен: ${e?.message || 'ошибка'}` }, { status: 500 })
  }
}
