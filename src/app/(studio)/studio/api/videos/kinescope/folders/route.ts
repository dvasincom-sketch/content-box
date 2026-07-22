import { NextResponse } from 'next/server'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { kinescopeListFolders } from '@/lib/kinescope'

/**
 * Список папок Kinescope — для фильтра в пикере «Библиотека». Только автор.
 * GET /studio/api/videos/kinescope/folders → { ok, folders: [{ id, name }] }
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  try {
    const folders = await kinescopeListFolders()
    return NextResponse.json(
      { ok: true, folders },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e: any) {
    return NextResponse.json(
      { error: `Kinescope: ${e?.message || 'не удалось получить папки'}` },
      { status: 502 },
    )
  }
}
