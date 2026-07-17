import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { streamGetVideo } from '@/lib/cfStream'

/**
 * Статус кодирования видео. По id записи Videos берём videoRef (uid) и
 * спрашиваем Stream, готово ли. Не храним статус в БД — тянем на лету.
 *
 * GET ?id=<videoDocId>
 * Ответ: { ready, state, pct, duration }
 */
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Не указан id' }, { status: 400 })

  const payload = await getPayload({ config: await config })

  // берём запись, проверяем тенант
  let doc: any
  try {
    doc = await payload.findByID({ collection: 'videos', id, depth: 0, overrideAccess: true })
  } catch {
    return NextResponse.json({ error: 'Видео не найдено' }, { status: 404 })
  }
  const docTenant = doc?.tenant && typeof doc.tenant === 'object' ? doc.tenant.id : doc?.tenant
  if (Number(docTenant) !== Number(author.tenantId)) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }

  const uid = doc.videoRef
  if (!uid) return NextResponse.json({ ready: false, state: 'no-uid' })

  try {
    const v = await streamGetVideo(uid)
    // при готовности можно подтянуть длительность в запись (необязательно)
    if (v.readyToStream && v.duration && !doc.durationSec) {
      await payload
        .update({
          collection: 'videos',
          id,
          data: { durationSec: Math.round(v.duration) } as any,
          overrideAccess: true,
        })
        .catch(() => {})
    }
    return NextResponse.json({
      ready: v.readyToStream,
      state: v.status?.state || (v.readyToStream ? 'ready' : 'processing'),
      pct: v.status?.pctComplete || null,
      duration: v.duration || null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Ошибка Stream' }, { status: 502 })
  }
}
