import type { CollectionConfig } from 'payload'
import { tenantScoped, isSuperAdmin, getUserTenantID } from '../access'

/**
 * SiteSettings (ТЗ §3.3) — one record per tenant (branding, theme, SEO
 * defaults, nav, footer, socials). Runs as isGlobal via the multi-tenant
 * plugin so exactly one document exists per tenant. `tenant` field injected
 * by the plugin. Public read (front-end renders the branded shell).
 */
export const SiteSettings: CollectionConfig = {
  slug: 'site-settings',
  labels: { singular: 'Site Settings', plural: 'Site Settings' },
  admin: { useAsTitle: 'id' },
  access: {
    read: () => true,
    create: tenantScoped,
    update: tenantScoped,
    delete: ({ req: { user } }) =>
      isSuperAdmin(user as any) || Boolean(getUserTenantID(user as any)),
  },
  fields: [
    // `tenant` added by the multi-tenant plugin.
    { name: 'logo', type: 'upload', relationTo: 'media', label: 'Логотип' },
    {
      name: 'theme',
      type: 'group',
      label: 'Тема (токены)',
      fields: [
        { name: 'primary', type: 'text', admin: { description: 'напр. #7C3AED' } },
        { name: 'accent', type: 'text' },
        { name: 'background', type: 'text' },
        { name: 'surface', type: 'text' },
        { name: 'text', type: 'text' },
      ],
    },
    {
      name: 'socials',
      type: 'array',
      label: 'Соцсети',
      labels: { singular: 'Соцсеть', plural: 'Соцсети' },
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          options: [
            { label: 'Boosty', value: 'boosty' },
            { label: 'VK', value: 'vk' },
            { label: 'Telegram', value: 'telegram' },
            { label: 'YouTube', value: 'youtube' },
            { label: 'Instagram', value: 'instagram' },
          ],
        },
        { name: 'url', type: 'text', required: true },
      ],
    },
    {
      name: 'seoDefaults',
      type: 'group',
      label: 'SEO по умолчанию',
      fields: [
        { name: 'titleTemplate', type: 'text', admin: { description: 'напр. "%s — COCO JAMBO"' } },
        { name: 'description', type: 'textarea' },
        { name: 'ogImage', type: 'upload', relationTo: 'media' },
      ],
    },
    {
      name: 'navigation',
      type: 'array',
      label: 'Навигация',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
    {
      name: 'footer',
      type: 'group',
      label: 'Футер',
      fields: [
        { name: 'text', type: 'textarea' },
        { name: 'copyright', type: 'text' },
      ],
    },
  ],
  timestamps: true,
}
