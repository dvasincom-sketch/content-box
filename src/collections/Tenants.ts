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
    // --- Онбординг автора (заполняется мастером в /studio/onboarding) ---
    {
      name: 'subdomain',
      type: 'text',
      unique: true,
      index: true,
      label: 'Поддомен',
      admin: {
        description: 'Часть до .contentbox.site. `domain` = <subdomain>.contentbox.site.',
      },
    },
    {
      name: 'category',
      type: 'select',
      label: 'Категория (ниша)',
      options: [
        { label: 'Блогер', value: 'blogger' },
        { label: 'Музыкант', value: 'musician' },
        { label: 'Подкастер', value: 'podcaster' },
        { label: 'Стример', value: 'streamer' },
        { label: 'Художник', value: 'artist' },
        { label: 'Образование', value: 'education' },
        { label: 'Другое', value: 'other' },
      ],
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Короткое описание проекта',
    },
    {
      name: 'onboardingStep',
      type: 'number',
      defaultValue: 0,
      label: 'Шаг онбординга',
      admin: { description: 'Индекс шага мастера для возобновления. 0 — не начат.' },
    },
    {
      name: 'onboardingComplete',
      type: 'checkbox',
      defaultValue: false,
      label: 'Онбординг завершён',
    },
  ],
  timestamps: true, // provides createdAt / updatedAt
}
