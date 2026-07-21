import { NextResponse } from 'next/server'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Лёгкая проверка сессии автора для студии.
 * 200 { ok: true } — сессия жива; 401 { ok: false } — истекла/нет.
 *
 * Используется клиентским SessionGuard: при возврате фокуса на вкладку и по
 * интервалу пингует этот роут; на 401 показывает экран «Сессия истекла».
 * Ответ не кэшируется (no-store), чтобы проверка была всегда актуальной.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const author = await getCurrentAuthor()
  if (!author) {
    return NextResponse.json(
      { ok: false },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }
  return NextResponse.json(
    { ok: true },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  )
}
