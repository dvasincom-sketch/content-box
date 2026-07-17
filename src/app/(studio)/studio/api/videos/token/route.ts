import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { streamSignToken } from '@/lib/cfStream'

/**
 * Выдаёт подписанный токен для просмотра видео АВТОРОМ в студии (превью).
 * Автор всегда имеет доступ к видео своего тенанта — проверки подписки нет,
 * только принадлежность тенанту.
 *
 * GET ?id=<videoDocId>
 * Ответ: { token, uid, customerCode? }
 */
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Не указан id' }, { status: 400 })

  const payload = await getPayload({ config: await config })

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
  if (!uid) return NextResponse.json({ error: 'У видео нет привязки к Stream' }, { status: 400 })

  try {
    const token = await streamSignToken(uid, 2 * 60 * 60) // 2 часа
    return NextResponse.json({
      ok: true,
      token,
      uid,
      customerCode: process.env.CF_STREAM_CUSTOMER_CODE || null,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: `Не удалось подписать токен: ${e?.message || 'ошибка'}` },
      { status: 500 },
    )
  }
}
