import { getPayload } from 'payload'
import { headers as getHeaders } from 'next/headers.js'
import config from '@/payload.config'
import type { User, Subscriber } from '@/payload-types'

/**
 * Ядро серверной аутентификации: читает httpOnly-cookie через payload.auth и
 * возвращает пользователя из любой auth-коллекции (users | subscribers) либо
 * null. Ошибки глотаются → null.
 *
 * Обёртки `getCurrentAuthor` и `getCurrentSubscriber` фильтруют результат по
 * полю-дискриминанту `collection` — раньше обе повторяли этот же блок.
 */
export async function authenticatedUser(): Promise<User | Subscriber | null> {
  try {
    const payload = await getPayload({ config: await config })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })
    return user ?? null
  } catch {
    return null
  }
}
