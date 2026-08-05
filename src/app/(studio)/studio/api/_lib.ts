import { NextResponse, type NextRequest } from 'next/server'
import { getPayload, type Payload, type CollectionSlug } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { isSameOrigin, isMutating } from '@/lib/sameOrigin'
import { loadEntitlements, canUse, type Capability } from '@/lib/studioEntitlements'

/**
 * Общая обвязка серверных роутов студии (`(studio)/studio/api/**`).
 *
 * Раньше каждый из ~57 роутов повторял один и тот же boilerplate: проверку
 * автора с ответом 401, разбор JSON с ответом 400, инициализацию Payload,
 * извлечение id тенанта из relation и локальные копии `belongsToTenant` /
 * `findSettings`. Всё это собрано здесь. Формат ответов и поведение прежние.
 *
 * Файл не роут (не `route.ts`), поэтому Next его не маршрутизирует.
 */

/** Залогиненный автор (владелец тенанта) — результат getCurrentAuthor без null. */
export type Author = NonNullable<Awaited<ReturnType<typeof getCurrentAuthor>>>

export interface AuthorContext {
  req: NextRequest
  author: Author
  payload: Payload
  /** id тенанта текущего автора (то же, что author.tenantId). */
  tenantId: number
}

/** JSON-ответ об ошибке в едином формате `{ error }`. */
export function apiError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

/** JSON-ответ об успехе: `{ ok: true, ...extra }`. */
export function apiOk(extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ ok: true, ...(extra ?? {}) })
}

/**
 * Обёртка роута студии: требует автора (иначе 401 «Не авторизован»), поднимает
 * Payload и передаёт хендлеру `{ req, author, payload, tenantId }`. Без брошенных
 * исключений — ошибки хендлер возвращает сам через `apiError()`.
 *
 * Здесь же единая CSRF-проверка на мутирующие методы: это самое узкое место —
 * multipart-роуты (upload-cover, settings/logo, gallery-images/upload) отправляются
 * кросс-доменной формой без preflight'а, а сессию хендлеры читают из куки.
 */
export function withAuthor(
  handler: (ctx: AuthorContext) => Promise<Response> | Response,
): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest): Promise<Response> => {
    if (isMutating(req.method) && !isSameOrigin(req)) {
      return apiError('Запрос с постороннего origin', 403)
    }
    const author = await getCurrentAuthor()
    if (!author) return apiError('Не авторизован', 401)
    const payload = await getPayload({ config: await config })
    return handler({ req, author, payload, tenantId: author.tenantId })
  }
}

/**
 * Тело запроса как JSON, либо `undefined` при ошибке разбора. Проверка — на
 * стороне хендлера: `if (data === undefined) return apiError('Некорректный запрос')`.
 */
export async function readJson<T = any>(req: NextRequest): Promise<T | undefined> {
  try {
    return (await req.json()) as T
  } catch {
    return undefined
  }
}

/**
 * id связи-тенанта из документа: relation приходит как id (number) или как
 * populated-объект `{ id }`. null, если тенанта нет.
 */
export function tenantIdOf(doc: unknown): number | null {
  const t = (doc as { tenant?: unknown } | null)?.tenant
  const raw = t && typeof t === 'object' ? (t as { id?: unknown }).id : t
  return raw == null ? null : Number(raw)
}

/** Документ существует и принадлежит тенанту? (findByID + overrideAccess). */
export async function belongsToTenant(
  payload: Payload,
  collection: CollectionSlug,
  id: string | number,
  tenantId: number,
): Promise<boolean> {
  try {
    const doc = await payload.findByID({ collection, id, depth: 0, overrideAccess: true })
    return tenantIdOf(doc) === Number(tenantId)
  } catch {
    return false
  }
}

/**
 * Единственная запись site-settings тенанта (одна на тенант, depth:0). null, если нет.
 */
export async function findTenantSettings(payload: Payload, tenantId: number) {
  const res = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs[0] ?? null
}

/**
 * Есть ли у тенанта право на возможность студии (гейтинг тарифом). Fail-open:
 * при отсутствии данных о правах — true (как и дефолты миграции).
 */
export async function hasCapability(payload: Payload, tenantId: number, cap: Capability): Promise<boolean> {
  const ent = await loadEntitlements(payload, tenantId)
  return canUse(ent, cap)
}

/** Ограниченный участник тенанта (роль 'contributor'). */
export function isContributor(author: Author): boolean {
  return (author.user as { tenantRole?: string | null }).tenantRole === 'contributor'
}

/**
 * Может ли автор мутировать запись: участник — только свою (owner === self);
 * полноправный сотрудник — любую (тенант проверяется в самом роуте). Запись
 * читается overrideAccess. false, если участник не владелец или записи нет.
 */
export async function ownsForContributor(
  payload: Payload,
  collection: CollectionSlug,
  id: string | number,
  author: Author,
): Promise<boolean> {
  if (!isContributor(author)) return true
  try {
    const doc = await payload.findByID({ collection, id, depth: 0, overrideAccess: true })
    const owner = (doc as { owner?: unknown } | null)?.owner
    const ownerId = owner && typeof owner === 'object' ? (owner as { id?: unknown }).id : owner
    return ownerId != null && Number(ownerId) === Number(author.user.id)
  } catch {
    return false
  }
}

/** where-фрагмент для студийных списков: участник — только своё, иначе null. */
export function ownerWhere(author: Author): Record<string, unknown> | null {
  return isContributor(author) ? { owner: { equals: author.user.id } } : null
}
