import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { kinescopeListVideos } from '@/lib/kinescope'

/**
 * Список видео из аккаунта Kinescope — для импорта в студию уже загруженных
 * через app.kinescope.io роликов. Только для авторизованного автора.
 *
 * GET /studio/api/videos/kinescope/library?page=1&q=<поиск>
 * Ответ: { ok, items: [{ id, title, status, ready, duration, posterUrl }],
 *          page, perPage, total }
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const url = new URL(req.url)
  const page = Math.max(1, Number(url.searchParams.get('page') || '1') || 1)
  const query = url.searchParams.get('q') || undefined
  const folderId = url.searchParams.get('folderId') || undefined

  try {
    const res = await kinescopeListVideos({ page, perPage: 24, query, folderId })
    return NextResponse.json(
      { ok: true, ...res },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e: any) {
    return NextResponse.json(
      { error: `Kinescope: ${e?.message || 'не удалось получить список видео'}` },
      { status: 502 },
    )
  }
}
