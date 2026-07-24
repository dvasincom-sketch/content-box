import { authenticatedUser } from '@/lib/currentUser'

/**
 * Текущий залогиненный подписчик (или null) на серверной стороне.
 *
 * Читает httpOnly-cookie через payload.auth, который сам разбирает токен.
 * Возвращает пользователя ТОЛЬКО если он из коллекции subscribers — админ
 * (users) сюда не просочится (разные коллекции/куки).
 */
export async function getCurrentSubscriber() {
  const user = await authenticatedUser()
  if (user && (user as any).collection === 'subscribers') {
    return user as any
  }
  return null
}
