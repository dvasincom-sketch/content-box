import type { CollectionConfig } from 'payload'
import { publicReadTenantWrite, getUserTenantID } from '../access'

/**
 * Publications (ТЗ §3.5) — core content type. Tenant-scoped, public read.
 *
 * Key field `sources` (array of media sources):
 *  - type 'external': { platform, url }  → Boosty/VK/Telegram/YouTube (used now)
 *  - type 'hosted':   { media }          → own video storage (reserved, Stage 2)
 *
 * `slug` unique within tenant (same pattern as Categories).
 */
export const Publications: CollectionConfig = {
  slug: 'publications',
  labels: { singular: 'Publication', plural: 'Publications' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'publishedAt', 'featured'],
  },
  access: publicReadTenantWrite,
  fields: [
    // `tenant` added by the multi-tenant plugin.
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      label: 'Slug (уникален в пределах тенанта)',
    },
    { name: 'cover', type: 'upload', relationTo: 'media', label: 'Обложка карточки' },
    { name: 'publishedAt', type: 'date', label: 'Дата публикации' },
    { name: 'category', type: 'relationship', relationTo: 'categories' },
    { name: 'description', type: 'richText' },
    {
      name: 'sources',
      type: 'array',
      label: 'Источники',
      labels: { singular: 'Источник', plural: 'Источники' },
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          defaultValue: 'external',
          options: [
            { label: 'Внешняя ссылка', value: 'external' },
            { label: 'Своё видео (задел)', value: 'hosted' },
          ],
        },
        {
          name: 'platform',
          type: 'select',
          label: 'Площадка',
          options: [
            { label: 'Boosty', value: 'boosty' },
            { label: 'VK', value: 'vk' },
            { label: 'Telegram', value: 'telegram' },
            { label: 'YouTube', value: 'youtube' },
          ],
          admin: { condition: (_, sibling) => sibling?.type === 'external' },
        },
        {
          name: 'url',
          type: 'text',
          label: 'Ссылка',
          admin: { condition: (_, sibling) => sibling?.type === 'external' },
        },
        {
          name: 'media',
          type: 'upload',
          relationTo: 'media',
          label: 'Медиа (Stage 2 — не используется)',
          admin: { condition: (_, sibling) => sibling?.type === 'hosted' },
        },
      ],
      validate: (rows: any) => {
        if (!Array.isArray(rows)) return true
        for (const r of rows) {
          if (r?.type === 'external' && (!r.platform || !r.url)) {
            return 'Для внешнего источника укажите площадку и ссылку.'
          }
        }
        return true
      },
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      label: 'Featured (hero / «новинка»)',
    },
    {
      name: 'seo',
      type: 'group',
      label: 'SEO (оверрайды)',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'description', type: 'textarea' },
        { name: 'ogImage', type: 'upload', relationTo: 'media' },
      ],
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req, originalDoc }) => {
        if (!data?.slug) return data
        const tenantID =
          (data.tenant &&
            (typeof data.tenant === 'object' ? data.tenant.id : data.tenant)) ||
          originalDoc?.tenant ||
          getUserTenantID(req.user as any)
        if (!tenantID) return data

        const existing = await req.payload.find({
          collection: 'publications',
          where: {
            and: [{ tenant: { equals: tenantID } }, { slug: { equals: data.slug } }],
          },
          limit: 1,
          overrideAccess: true,
          depth: 0,
        })
        const clash = existing.docs.find((d: any) => d.id !== originalDoc?.id)
        if (clash) {
          throw new Error(`Публикация со slug "${data.slug}" уже существует в этом тенанте.`)
        }
        return data
      },
    ],
  },
  timestamps: true,
}
