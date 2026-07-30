import type { Access, FieldAccess, Where} from 'payload'

/**
 * Shared access-control helpers.
 *
 * Two access planes (ТЗ §2):
 *  - Platform plane: user.platformRole === 'superadmin' → sees everything, no `tenant`.
 *  - Tenant plane:   user.tenant + user.tenantRole       → sees only own `tenant`.
 *
 * Rule (cross-cutting): a tenant user may read/write ONLY records whose
 * `tenant` equals their own. `superadmin` is the exception and sees all.
 *
 * The multi-tenant plugin injects the `tenant` field; here we express the
 * scoping ourselves (we run the plugin with useTenantAccess:false, since the
 * ТЗ uses a single-tenant user model rather than the plugin's tenants array).
 */

// Minimal shape of our user for access checks. The generated payload-types
// will have the full type; we keep this loose to avoid a circular dependency
// on the generated file during first build.
type MaybeUser =
  | {
      id: string | number
      /** Auth-коллекция, из которой пришёл пользователь: 'users' | 'subscribers'. */
      collection?: string
      platformRole?: string | null
      tenant?: string | number | { id: string | number } | null
    }
  | null
  | undefined

/**
 * Персонал платформы/тенанта — пользователь из auth-коллекции `users`.
 *
 * ВАЖНО: плагин мультитенантности инжектит поле `tenant` И в `subscribers`
 * (зрители сайта), поэтому одного наличия `tenant` недостаточно — без этой
 * проверки залогиненный ЗРИТЕЛЬ проходил бы все tenant-scoped правила как
 * редактор и мог читать/править контент через публичный REST.
 */
export const isStaff = (user: MaybeUser): boolean =>
  Boolean(user && user.collection === 'users')

/**
 * Зритель сайта — пользователь из auth-коллекции `subscribers`.
 *
 * Парная к isStaff. Раньше эта проверка была россыпью `(user as any)?.collection
 * === 'subscribers'` по семи коллекциям: каст скрывал от компилятора ровно тот
 * дискриминант, на котором держится разделение прав.
 */
export const isSubscriber = (user: MaybeUser): boolean =>
  Boolean(user && user.collection === 'subscribers')

export const isSuperAdmin = (user: MaybeUser): boolean =>
  Boolean(user && isStaff(user) && user.platformRole === 'superadmin')

export const getUserTenantID = (user: MaybeUser): string | number | undefined => {
  if (!user || !isStaff(user) || !user.tenant) return undefined
  return typeof user.tenant === 'object' ? user.tenant.id : user.tenant
}

/** Superadmin only. Used for the Tenants collection. */
export const superAdminOnly: Access = ({ req: { user } }) => isSuperAdmin(user as MaybeUser)

/**
 * Superadmin sees all; a tenant user is constrained to their own tenant's rows.
 * Anonymous → denied. Returns a Where-query so Payload narrows the result set.
 */
export const tenantScoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user as MaybeUser)) return true
  const tenantID = getUserTenantID(user as MaybeUser)
  if (!tenantID) return false
  return { tenant: { equals: tenantID } }
}

/**
 * Контентные коллекции: чтение и запись только в пределах своего тенанта.
 *
 * Раньше здесь стояло `read: () => true` с расчётом на то, что изоляцию даёт
 * доменный слой (proxy.ts). Расчёт неверен: Payload REST смонтирован на
 * `/api/[...slug]`, а `/api` — в BYPASS_PREFIXES прокси, то есть доменный слой
 * на этих путях не работает вовсе. В результате `GET /api/publications`
 * анонимно отдавал материалы ВСЕХ тенантов, включая платные (полное поле
 * `description`) и черновики (`publishedAt: null`).
 *
 * Публичному сайту открытый REST не нужен: весь SSR ходит через Local API
 * (`payload.find`), где `overrideAccess` по умолчанию true, а файлы раздаются
 * из R2 мимо Payload (`disablePayloadAccessControl: true`).
 */
export const tenantScopedCollection = {
  read: tenantScoped,
  create: tenantScoped,
  update: tenantScoped,
  delete: tenantScoped,
}

/** Field-level: only a superadmin may set a field (e.g. platformRole). */
export const superAdminFieldAccess: FieldAccess = ({ req: { user } }) =>
  isSuperAdmin(user as MaybeUser)

/**
 * Tenants read: superadmin sees all; everyone else (incl. anonymous domain
 * resolution in proxy.ts) sees only ACTIVE + verified tenants. Lets the public
 * site resolve its tenant by domain without exposing pending/suspended rows.
 */
export const tenantsPublicRead: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user as MaybeUser)) return true
  const query: Where = {
    and: [
      { status: { equals: 'active' } },
      { domainVerified: { equals: true } },
    ],
  }
  return query
}
