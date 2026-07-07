import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID, superAdminFieldAccess } from '../access'

/**
 * Users (ТЗ §3.2) — auth collection (the admin-panel user collection).
 *
 * A user has EITHER `platformRole` (platform plane, no tenant) OR
 * `tenant` + `tenantRole` (tenant plane). Enforced in beforeValidate.
 *
 * Access: superadmin → all users; editor → only users in their own tenant.
 * email/password/hash handled by Payload via `auth: true`.
 */

const usersScoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user as any)) return true
  const tenantID = getUserTenantID(user as any)
  if (!tenantID) return false
  return { tenant: { equals: tenantID } }
}

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  labels: { singular: 'User', plural: 'Users' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'platformRole', 'tenantRole', 'tenant'],
  },
  access: {
    read: usersScoped,
    create: ({ req: { user } }) => {
      if (isSuperAdmin(user as any)) return true
      return Boolean(getUserTenantID(user as any))
    },
    update: usersScoped,
    delete: usersScoped,
    admin: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    // `email` and `password` are injected by `auth: true`.
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      index: true,
      label: 'Тенант',
      admin: {
        description: 'Пусто для платформенных пользователей (superadmin).',
        condition: (data) => data?.platformRole !== 'superadmin',
      },
    },
    {
      name: 'platformRole',
      type: 'select',
      label: 'Платформенная роль',
      options: [{ label: 'Super Admin', value: 'superadmin' }],
      admin: { description: 'Только для платформенных пользователей.' },
      access: {
        create: superAdminFieldAccess,
        update: superAdminFieldAccess,
      },
    },
    {
      name: 'tenantRole',
      type: 'select',
      defaultValue: 'editor',
      label: 'Роль в тенанте',
      options: [
        { label: 'Editor', value: 'editor' },
        // Reserved in enum for future use (ТЗ §2) — no Stage-1 logic, declared
        // now so extending roles needs no migration.
        { label: 'Admin (задел)', value: 'admin' },
        { label: 'Viewer (задел)', value: 'viewer' },
      ],
      admin: { condition: (data) => data?.platformRole !== 'superadmin' },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) return data
        if (data.platformRole === 'superadmin') {
          data.tenant = null
          data.tenantRole = null
        }
        return data
      },
    ],
  },
  timestamps: true,
}
