import type { CollectionConfig } from 'payload'
import { publicReadTenantWrite, getUserTenantID } from '../access'

/**
 * Categories (ТЗ §3.4) — tenant-scoped taxonomy. Public read, tenant-scoped
 * writes. `tenant` injected by the plugin. `slug` unique WITHIN a tenant (not
 * globally) — enforced by the beforeValidate lookup below.
 */
export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'Категория', plural: 'Категории' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', 'order'] },
  access: publicReadTenantWrite,
  fields: [
    // `tenant` added by the multi-tenant plugin.
    { name: 'title', type: 'text', required: true, label: 'Название' },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      label: 'Slug (уникален в пределах тенанта)',
    },
    { name: 'cover', type: 'upload', relationTo: 'media', label: 'Обложка' },
    { name: 'description', type: 'textarea' },
    { name: 'order', type: 'number', defaultValue: 0, label: 'Сортировка' },
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
          collection: 'categories',
          where: {
            and: [{ tenant: { equals: tenantID } }, { slug: { equals: data.slug } }],
          },
          limit: 1,
          overrideAccess: true,
          depth: 0,
        })
        const clash = existing.docs.find((d: any) => d.id !== originalDoc?.id)
        if (clash) {
          throw new Error(`Категория со slug "${data.slug}" уже существует в этом тенанте.`)
        }
        return data
      },
    ],
  },
  timestamps: true,
}
