import { NextResponse, type NextRequest } from 'next/server'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { isSameOrigin, isMutating } from '@/lib/sameOrigin'
import type { Subscriber } from '@/payload-types'

/**
 * Обвязка серверных роутов личного кабинета подписчика (`(frontend)/account/api/**`).
 * Требует залогиненного подписчика (иначе 401), отсекает заблокированных (403),
 * поднимает Payload и отдаёт хендлеру { req, subscriber, payload, tenantId }.
 * tenantId берём из самого подписчика (не доверяем клиенту).
 */
export function apiError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status })
}
export function apiOk(extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ ok: true, ...(extra ?? {}) })
}
export async function readJson<T = any>(req: NextRequest): Promise<T | undefined> {
  try {
    return (await req.json()) as T
  } catch {
    return undefined
  }
}

export interface SubscriberContext {
  req: NextRequest
  subscriber: Subscriber
  payload: Payload
  tenantId: number | null
}

function tenantIdOf(sub: Subscriber): number | null {
  const t = (sub as any).tenant
  const raw = t && typeof t === 'object' ? t.id : t
  return raw == null ? null : Number(raw)
}

export function withSubscriber(
  handler: (ctx: SubscriberContext) => Promise<Response> | Response,
): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest): Promise<Response> => {
    // CSRF: /account/api/avatar принимает multipart, то есть отправляется
    // кросс-доменной формой без preflight'а, а сессия читается из куки.
    if (isMutating(req.method) && !isSameOrigin(req)) {
      return apiError('Запрос с постороннего origin', 403)
    }
    const subscriber = await getCurrentSubscriber().catch(() => null)
    if (!subscriber) return apiError('Войдите в аккаунт', 401)
    if ((subscriber as any).isBlocked) return apiError('Аккаунт заблокирован', 403)
    const payload = await getPayload({ config: await config })
    return handler({ req, subscriber, payload, tenantId: tenantIdOf(subscriber) })
  }
}
