import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { slugify } from '@/lib/slugify'
import { streamGetVideo } from '@/lib/cfStream'

/**
 * Создаёт запись Videos после успешной TUS-загрузки. Браузер уже залил файл в
 * Stream и знает uid — здесь мы фиксируем видео в БД.
 *
 * Проверяем, что uid реально существует в Stream (защита от подделки uid).
 *
 * Body: { uid, title, minTierId?, isPreview?, categoryId? }
 */
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let data: any
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  const uid = String(data.uid || '').trim()
  const title = String(data.title || '').trim()
  if (!uid) return NextResponse.json({ error: 'Нет идентификатора видео' }, { status: 400 })
  if (!title) return NextResponse.json({ error: 'Укажите название' }, { status: 400 })

  // Проверяем, что видео с таким uid реально есть в нашем Stream-аккаунте
  try {
    await streamGetVideo(uid)
  } catch {
    return NextResponse.json({ error: 'Видео не найдено в Stream' }, { status: 404 })
  }

  const payload = await getPayload({ config: await config })
  try {
    const doc = await payload.create({
      collection: 'videos',
      data: {
        title,
        slug: slugify(title) || uid,
        videoRef: uid,
        minTier: numOrNull(data.minTierId),
        isPreview: Boolean(data.isPreview),
        category: numOrNull(data.categoryId),
        tenant: author.tenantId,
      } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, id: doc.id, uid })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось создать запись видео' },
      { status: 500 },
    )
  }
}

function numOrNull(v: any): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
