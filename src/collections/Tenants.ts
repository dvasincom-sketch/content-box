import type { CollectionConfig } from 'payload'
import { superAdminOnly, tenantsPublicRead } from '../access'

/**
 * Tenants (ТЗ §3.1) — platform plane. Managed by `superadmin` only.
 *
 * SECURITY: a domain must not be activatable without proof of ownership
 * (DNS TXT). The validate on `status` blocks flipping to `active` while
 * `domainVerified` is false — otherwise someone could bind an unverified
 * (possibly someone else's) brand domain.
 */
export const Tenants: CollectionConfig = {
  slug: 'tenants',
  labels: { singular: 'Проект', plural: 'Проекты' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'domain', 'status', 'plan', 'domainVerified'],
  },
  access: {
    read: tenantsPublicRead,
    create: superAdminOnly,
    update: superAdminOnly,
    delete: superAdminOnly,
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Название проекта' },
    {
      name: 'domain',
      type: 'text',
      required: true,
      unique: true,
      index: true, // middleware resolves tenants by domain on every request
      label: 'Домен',
      admin: { description: 'Полный домен, напр. bts.example.com' },
    },
    {
      name: 'domainVerified',
      type: 'checkbox',
      defaultValue: false,
      label: 'Домен подтверждён (DNS TXT)',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
      ],
      validate: (value: unknown, { siblingData }: { siblingData: any }) => {
        if (value === 'active' && !siblingData?.domainVerified) {
          return 'Нельзя активировать тенант без верификации домена (DNS TXT).'
        }
        return true
      },
    },
    {
      name: 'plan',
      type: 'select',
      defaultValue: 'free',
      label: 'Тариф (задел под биллинг)',
      options: [
        { label: 'Free', value: 'free' },
        { label: 'Basic', value: 'basic' },
        { label: 'Pro', value: 'pro' },
      ],
    },
  ],
  timestamps: true, // provides createdAt / updatedAt
}
