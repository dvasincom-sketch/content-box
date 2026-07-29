import { headers as nextHeaders } from 'next/headers'
import { authenticatedUser } from '@/lib/currentUser'
import type { Subscriber } from '@/payload-types'

/**
 * Текущий залогиненный подписчик (или null) на серверной стороне.
 *
 * Читает httpOnly-cookie через payload.auth, который сам разбирает токен.
 * Возвращает пользователя ТОЛЬКО если он из коллекции subscribers — админ
 * (users) сюда не просочится (разные коллекции/куки).
 *
 * КРОМЕ ТОГО подписчик обязан принадлежать ТЕКУЩЕМУ тенанту. Без этой сверки
 * подписка была кросс-тенантной: email у subscribers уникален глобально, логин
 * идёт через общий `/api/subscribers/login`, а гейтинг сравнивает только
 * числовые веса тарифов — то есть оплата у автора A открывала платный контент
 * у автора B. Тенант берётся из явного аргумента (роуты под `/api/*`, куда
 * proxy.ts не ставит заголовок) либо из `x-tenant-id` (обычный SSR).
 *
 * Если тенант определить не удалось — возвращаем null: «неизвестный тенант»
 * должен закрывать доступ, а не открывать.
 */
export async function getCurrentSubscriber(
  tenantId?: string | number | null,
): Promise<Subscriber | null> {
  const user = await authenticatedUser()
  if (!user || user.collection !== 'subscribers') return null

  const currentTenant = tenantId != null ? String(tenantId) : await tenantIdFromHeaders()
  if (!currentTenant) return null

  const own = relId(user.tenant)
  if (!own || own !== currentTenant) return null

  return user
}

/** id связи, независимо от depth (число/строка или populated-объект). */
function relId(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'object') {
    const id = (v as { id?: string | number }).id
    return id == null ? null : String(id)
  }
  return String(v)
}

async function tenantIdFromHeaders(): Promise<string | null> {
  try {
    const h = await nextHeaders()
    return h.get('x-tenant-id')
  } catch {
    // Вне контекста запроса (скрипты, воркеры) заголовков нет.
    return null
  }
}
