import type { CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/**
 * SiteSettings (ТЗ §3.3) — one record per tenant (branding, theme, SEO
 * defaults, nav, footer, socials). Runs as isGlobal via the multi-tenant
 * plugin so exactly one document exists per tenant. `tenant` field injected
 * by the plugin. Public read (front-end renders the branded shell).
 */
export const SiteSettings: CollectionConfig = {
  slug: 'site-settings',
  labels: { singular: 'Настройки сайта', plural: 'Настройки сайта' },
  admin: { useAsTitle: 'id' },
  access: {
    read: () => true,
    create: ({ req: { user } }) =>
      isSuperAdmin(user as any) || Boolean(getUserTenantID(user as any)),
    update: ({ req: { user } }) =>
      isSuperAdmin(user as any) || Boolean(getUserTenantID(user as any)),
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
      name: 'typography',
      type: 'group',
      label: 'Типографика',
      fields: [
        {
          name: 'headingFont',
          type: 'select',
          label: 'Шрифт заголовков',
          defaultValue: 'inter',
          options: [
            { label: 'Inter', value: 'inter' },
            { label: 'Montserrat', value: 'montserrat' },
            { label: 'Manrope', value: 'manrope' },
            { label: 'Golos Text', value: 'golos' },
            { label: 'PT Sans', value: 'ptsans' },
            { label: 'Unbounded', value: 'unbounded' },
            { label: 'Roboto', value: 'roboto' },
          ],
        },
        {
          name: 'bodyFont',
          type: 'select',
          label: 'Шрифт текста',
          defaultValue: 'inter',
          options: [
            { label: 'Inter', value: 'inter' },
            { label: 'Montserrat', value: 'montserrat' },
            { label: 'Manrope', value: 'manrope' },
            { label: 'Golos Text', value: 'golos' },
            { label: 'PT Sans', value: 'ptsans' },
            { label: 'Roboto', value: 'roboto' },
          ],
        },
        {
          name: 'textSize',
          type: 'select',
          label: 'Размер текста',
          defaultValue: '18',
          options: [
            { label: '18px', value: '18' },
            { label: '20px', value: '20' },
            { label: '22px', value: '22' },
            { label: '24px', value: '24' },
          ],
        },
        {
          name: 'textWeight',
          type: 'select',
          label: 'Насыщенность текста',
          defaultValue: '400',
          options: [
            { label: 'Light', value: '300' },
            { label: 'Normal', value: '400' },
          ],
        },
        {
          name: 'headingWeight',
          type: 'select',
          label: 'Насыщенность заголовков',
          defaultValue: '700',
          options: [
            { label: 'Light', value: '300' },
            { label: 'Normal', value: '400' },
            { label: 'Medium', value: '500' },
            { label: 'Semibold', value: '600' },
            { label: 'Bold', value: '700' },
          ],
        },
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
