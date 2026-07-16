import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

/**
 * Выход автора. Payload REST-логаут чистит httpOnly-куку. Затем редирект на
 * экран входа. GET, чтобы работать простой ссылкой из навигации.
 */
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/studio/login', req.url))

  try {
    const payload = await getPayload({ config: await config })
    const cookiePrefix = payload.config.cookiePrefix || 'payload'
    // Payload-кука называется `${cookiePrefix}-token`. Удаляем её.
    res.cookies.set(`${cookiePrefix}-token`, '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
    })
  } catch {
    // даже при ошибке уводим на логин
  }

  return res
}
