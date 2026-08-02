import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { geoDebug } from '@/lib/geo'

/**
 * Диагностика гео-определения. Открой /api/geo-debug?whoami=1 (в т.ч. под VPN) —
 * покажет, какие заголовки реально приходят за прокси Timeweb, какой IP/страну
 * из них извлекаем и работает ли база в проде (self-test по известным адресам).
 *
 * Отдаёт только данные самогó вызывающего (его IP/страну). Требует ?whoami=1,
 * чтобы не отвечать краулерам. Временный — можно удалить после диагностики.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('whoami') !== '1') {
    return NextResponse.json({ hint: 'добавь ?whoami=1' }, { status: 404 })
  }
  const h = await headers()
  return NextResponse.json(await geoDebug(h), {
    headers: { 'cache-control': 'no-store' },
  })
}
