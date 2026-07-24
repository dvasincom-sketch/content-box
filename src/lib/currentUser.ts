import { getPayload } from 'payload'
import { headers as getHeaders } from 'next/headers.js'
import config from '@/payload.config'

/**
 * Ядро серверной аутентификации: читает httpOnly-cookie через payload.auth и
 * возвращает пользователя из любой auth-коллекции (users | subscribers) либо
 * null. Ошибки глотаются → null.
 *
 * Обёртки `getCurrentAuthor` и `getCurrentSubscriber` фильтруют результат по
 * нужной коллекции — раньше обе повторяли этот же блок getPayload/auth.
 */
export async function authenticatedUser(): Promise<any | null> {
  try {
    const payload = await getPayload({ config: await config })
    const headers = await getHeaders()
    const { user } = await payload.auth({ headers })
    return user ?? null
  } catch {
    return null
  }
}
