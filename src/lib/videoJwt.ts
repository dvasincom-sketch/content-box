import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Мини-JWT (HS256) для подписи доступа к HLS собственного видео. Без внешних
 * зависимостей — только crypto. Токен несёт playbackId и exp; выдаётся
 * /api/video-token ТОЛЬКО после checkVideoAccess, проверяется в /api/hls.
 */
const secret = () => process.env.VIDEO_JWT_SECRET || ''

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url')
}

export function signPlaybackToken(playbackId: string, ttlSec = 7200): string {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ pid: playbackId, iat: now, exp: now + ttlSec }))
  const data = `${header}.${payload}`
  const sig = createHmac('sha256', secret()).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifyPlaybackToken(token: string | null | undefined): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, p, s] = parts
  const expected = createHmac('sha256', secret()).update(`${h}.${p}`).digest('base64url')
  const a = Buffer.from(s)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  try { if (!timingSafeEqual(a, b)) return null } catch { return null }
  try {
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as { pid?: string; exp?: number }
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload.pid || null
  } catch {
    return null
  }
}
