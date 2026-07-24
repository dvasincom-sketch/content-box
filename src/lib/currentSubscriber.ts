import { authenticatedUser } from '@/lib/currentUser'
import type { Subscriber } from '@/payload-types'

/**
 * Текущий залогиненный подписчик (или null) на серверной стороне.
 *
 * Читает httpOnly-cookie через payload.auth, который сам разбирает токен.
 * Возвращает пользователя ТОЛЬКО если он из коллекции subscribers — админ
 * (users) сюда не просочится (разные коллекции/куки).
 */
export async function getCurrentSubscriber(): Promise<Subscriber | null> {
  const user = await authenticatedUser()
  if (user && user.collection === 'subscribers') {
    return user
  }
  return null
}
