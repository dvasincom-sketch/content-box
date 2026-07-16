import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

/**
 * Выход автора. Чистит httpOnly-куку Payload и редиректит на экран входа.
 * GET — чтобы работать простой ссылкой из навигации.
 *
 * ВАЖНО (фикс редиректа на localhost): за прокси Render `req.url` содержит
 * ВНУТРЕННИЙ адрес контейнера (localhost:10000), поэтому строить редирект от
 * req.url нельзя — уводит на localhost. Берём публичный origin из заголовков
 * прокси: x-forwarded-host + x-forwarded-proto, с фолбэком на host/req.url.
 */
export async function GET(req: NextRequest) {
  const origin = resolvePublicOrigin(req)
  const res = NextResponse.redirect(`${origin}/studio/login`)

  try {
    const payload = await getPayload({ config: await config })
    const cookiePrefix = payload.config.cookiePrefix || 'payload'
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

/**
 * Публичный origin (scheme://host) с учётом прокси Render.
 * Приоритет: x-forwarded-host + x-forwarded-proto → host → парсинг req.url.
 */
function resolvePublicOrigin(req: NextRequest): string {
  const h = req.headers
  const fwdHost = h.get('x-forwarded-host')
  const fwdProto = h.get('x-forwarded-proto')
  const host = fwdHost || h.get('host')

  if (host) {
    // на проде схема всегда https; локально может быть http
    const proto = fwdProto || (host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https')
    return `${proto}://${host}`
  }

  // крайний фолбэк — из req.url (может быть внутренним, но лучше чем ничего)
  try {
    return new URL(req.url).origin
  } catch {
    return ''
  }
}
