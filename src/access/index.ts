import type { Access, FieldAccess } from 'payload'

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
      platformRole?: string | null
      tenant?: string | number | { id: string | number } | null
    }
  | null
  | undefined

export const isSuperAdmin = (user: MaybeUser): boolean =>
  Boolean(user && user.platformRole === 'superadmin')

export const getUserTenantID = (user: MaybeUser): string | number | undefined => {
  if (!user || !user.tenant) return undefined
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
 * Public read (front-end renders unauthenticated) + tenant-scoped writes.
 * PUBLIC-site tenant isolation is enforced by the domain-resolving layer
 * (middleware queries with the resolved tenant), not by user access here.
 */
export const publicReadTenantWrite = {
  read: (() => true) as Access,
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
  return {
    and: [
      { status: { equals: 'active' } },
      { domainVerified: { equals: true } },
    ],
  }
}
