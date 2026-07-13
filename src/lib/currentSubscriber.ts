import { getPayload } from 'payload'
import { headers as getHeaders } from 'next/headers.js'
import config from '@/payload.config'

/**
 * Текущий залогиненный подписчик (или null) на серверной стороне.
 *
 * Читает httpOnly-cookie через payload.auth, который сам разбирает токен.
 * Возвращает пользователя ТОЛЬКО если он из коллекции subscribers — админ
 * (users) сюда не просочится (разные коллекции/куки).
 */
export async function getCurrentSubscriber() {
  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })
    if (user && (user as any).collection === 'subscribers') {
      return user as any
    }
    return null
  } catch {
    return null
  }
}
