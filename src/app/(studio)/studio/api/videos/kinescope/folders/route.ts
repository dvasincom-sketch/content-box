import { NextResponse } from 'next/server'
import { withAuthor, apiError } from '@/app/(studio)/studio/api/_lib'
import { kinescopeListFolders } from '@/lib/kinescope'

/**
 * Список папок Kinescope — для фильтра в пикере «Библиотека». Только автор.
 * GET /studio/api/videos/kinescope/folders → { ok, folders: [{ id, name }] }
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withAuthor(async () => {
  try {
    const folders = await kinescopeListFolders()
    return NextResponse.json(
      { ok: true, folders },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e: any) {
    return apiError(`Kinescope: ${e?.message || 'не удалось получить папки'}`, 502)
  }
})
