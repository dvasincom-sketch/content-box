import type { Access, FieldAccess, Where, CollectionBeforeChangeHook } from 'payload'
import { PRESETS } from '../lib/permissions'
import type { CapMatrix, ContentCaps, ContentAction, ContentEntity } from '../lib/permissions'

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

/* ============================================================================
   РОЛИ ТЕНАНТА И ВЛАДЕНИЕ КОНТЕНТОМ
   ----------------------------------------------------------------------------
   Роли (users.tenantRole): 'editor'/'admin' — полный доступ (владелец студии);
   'contributor' — ограниченный участник: создаёт контент и правит ТОЛЬКО свой,
   чужое не видит и не трогает; общие структуры (категории/тарифы/дизайн) — нет.
   Владение фиксируется полем `owner` (→ users) на контентных коллекциях.
   ============================================================================ */

/** Роль пользователя в тенанте ('editor' | 'admin' | 'contributor' | 'viewer'). */
export const getUserRole = (user: MaybeUser): string | undefined => {
  if (!user || !isStaff(user)) return undefined
  return (user as { tenantRole?: string | null }).tenantRole ?? undefined
}

/** Ограниченный участник тенанта. */
export const isContributor = (user: MaybeUser): boolean =>
  isStaff(user) && getUserRole(user) === 'contributor'

/** Полноправный сотрудник: суперадмин, либо editor/admin тенанта (не contributor/viewer). */
export const isFullStaff = (user: MaybeUser): boolean =>
  isSuperAdmin(user) ||
  (isStaff(user) && (getUserRole(user) === 'editor' || getUserRole(user) === 'admin'))

const userIdOf = (user: MaybeUser): string | number | undefined =>
  (user as { id?: string | number } | null | undefined)?.id

/**
 * Доступ к контенту с владельцем. Полный сотрудник — весь тенант; ограниченный
 * участник — только записи со своим `owner`. Аноним/зритель — отказ.
 */
export const ownerScoped: Access = ({ req: { user } }) => {
  const u = user as MaybeUser
  if (isSuperAdmin(u)) return true
  const tenantID = getUserTenantID(u)
  if (!tenantID) return false
  if (isContributor(u)) {
    const uid = userIdOf(u)
    if (uid == null) return false
    const own: Where = { and: [{ tenant: { equals: tenantID } }, { owner: { equals: uid } }] }
    return own
  }
  const scoped: Where = { tenant: { equals: tenantID } }
  return scoped
}

/**
 * Набор access для контентных коллекций с владельцем. Создавать может любой
 * сотрудник тенанта; читать/править/удалять ограниченный участник — только своё.
 */
export const ownerScopedCollection = {
  read: ownerScoped,
  create: tenantScoped,
  update: ownerScoped,
  delete: ownerScoped,
}

/** Field-access: изменять поле может только полный сотрудник (не участник). */
export const fullStaffFieldAccess: FieldAccess = ({ req: { user } }) =>
  isFullStaff(user as MaybeUser)

/**
 * Поле-владелец для контентных коллекций. Переназначить владельца может только
 * полный сотрудник; проставляется автоматически хуком `stampOwner` при создании.
 */
export const ownerField = {
  name: 'owner',
  type: 'relationship' as const,
  relationTo: 'users' as const,
  index: true,
  label: 'Владелец (создатель)',
  admin: {
    description:
      'Студийный аккаунт, создавший запись. Ограниченный участник видит и правит только свои записи.',
    position: 'sidebar' as const,
  },
  access: {
    update: fullStaffFieldAccess,
  },
}

/**
 * beforeChange-хук: при создании проставляет owner = текущий сотрудник, если он
 * ещё не задан. Studio-роуты задают owner явно (overrideAccess); хук — страховка
 * для прямого REST под сессией участника, чтобы он не мог создать «ничьё».
 */
export const stampOwner: CollectionBeforeChangeHook = ({ operation, data, req }) => {
  if (operation === 'create' && data && (data as { owner?: unknown }).owner == null) {
    const u = req?.user as MaybeUser
    if (u && isStaff(u)) (data as { owner?: unknown }).owner = userIdOf(u)
  }
  return data
}

/* ============================================================================
   ТОНКИЕ ПРАВА (capabilities) — Фаза 1
   ----------------------------------------------------------------------------
   Права участника = матрица `сущность × действие`. Владелец студии
   (isFullStaff: суперадмин или tenantRole editor/admin) короткозамкнут на
   «всё разрешено» — его capabilities игнорируются. Остальные участники
   (tenantRole 'contributor') управляются полем users.capabilities; при пустом
   поле берётся пресет по users.studioRole (или маппинг с tenantRole).
   Контент: create/viewAny/editOwn/editAny/deleteOwn/deleteAny (владение — поле
   owner). Структура/витрина: manage. Сообщество: moderate/manage.
   ============================================================================ */


const mapTenantToStudio = (tenantRole?: string | null): string => {
  switch (tenantRole) {
    case 'editor':
    case 'admin':
      return 'owner'
    case 'viewer':
      return 'viewer'
    case 'contributor':
    default:
      return 'author'
  }
}

/** Эффективная матрица прав участника (без короткого замыкания владельца). */
export const capabilitiesOf = (user: MaybeUser): CapMatrix => {
  const u = user as (MaybeUser & { capabilities?: unknown; studioRole?: string | null; tenantRole?: string | null }) | null
  if (!u) return {}
  const raw = u.capabilities
  if (raw && typeof raw === 'object') return raw as CapMatrix
  const role = (u.studioRole && String(u.studioRole)) || mapTenantToStudio(u.tenantRole)
  return PRESETS[role] ?? {}
}

/** Может ли пользователь выполнить действие над сущностью. Владелец/суперадмин — всегда. */
export const can = (
  user: MaybeUser,
  entity: keyof CapMatrix,
  action: ContentAction | 'manage' | 'moderate',
): boolean => {
  if (isFullStaff(user)) return true
  const node = capabilitiesOf(user)[entity] as Record<string, boolean> | undefined
  return Boolean(node && node[action])
}

/**
 * Access-набор для контентной коллекции с владельцем, управляемый правами.
 * Владелец/суперадмин — весь тенант; участник — по своей матрице (any → весь
 * тенант, own → только owner==self). Поведение «Автора» совпадает с прежним
 * ownerScoped, поэтому апгрейд не меняет доступ существующих участников.
 */
export const contentAccess = (entity: ContentEntity) => {
  const tenantWhere = (tid: string | number): Where => ({ tenant: { equals: tid } })
  const ownWhere = (tid: string | number, uid: string | number): Where => ({
    and: [{ tenant: { equals: tid } }, { owner: { equals: uid } }],
  })

  const read: Access = ({ req: { user } }) => {
    const u = user as MaybeUser
    if (isSuperAdmin(u)) return true
    const tid = getUserTenantID(u)
    if (!tid) return false
    if (isFullStaff(u)) return tenantWhere(tid)
    const c = (capabilitiesOf(u)[entity] ?? {}) as ContentCaps
    if (c.viewAny || c.editAny || c.deleteAny) return tenantWhere(tid)
    if (c.create || c.editOwn || c.deleteOwn) {
      const uid = userIdOf(u)
      return uid == null ? false : ownWhere(tid, uid)
    }
    return false
  }

  const create: Access = ({ req: { user } }) => {
    const u = user as MaybeUser
    if (isSuperAdmin(u)) return true
    const tid = getUserTenantID(u)
    if (!tid) return false
    const c = (capabilitiesOf(u)[entity] ?? {}) as ContentCaps
    if (isFullStaff(u) || c.create) return tenantWhere(tid)
    return false
  }

  const mutate = (own: 'editOwn' | 'deleteOwn', any: 'editAny' | 'deleteAny'): Access =>
    ({ req: { user } }) => {
      const u = user as MaybeUser
      if (isSuperAdmin(u)) return true
      const tid = getUserTenantID(u)
      if (!tid) return false
      if (isFullStaff(u)) return tenantWhere(tid)
      const c = (capabilitiesOf(u)[entity] ?? {}) as ContentCaps
      if (c[any]) return tenantWhere(tid)
      if (c[own]) {
        const uid = userIdOf(u)
        return uid == null ? false : ownWhere(tid, uid)
      }
      return false
    }

  return { read, create, update: mutate('editOwn', 'editAny'), delete: mutate('deleteOwn', 'deleteAny') }
}
