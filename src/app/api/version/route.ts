import { NextResponse } from 'next/server'

/**
 * Текущий build id развёрнутой версии. Значение запекается на сборке
 * (NEXT_PUBLIC_BUILD_ID в next.config), поэтому у нового деплоя оно другое.
 * Клиент сравнивает его со своим (тоже запечённым) и, если отличается,
 * показывает кнопку «Доступно обновление». Тенант тут не нужен.
 */
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { v: process.env.NEXT_PUBLIC_BUILD_ID || 'dev' },
    { headers: { 'Cache-Control': 'no-store, must-revalidate' } },
  )
}
