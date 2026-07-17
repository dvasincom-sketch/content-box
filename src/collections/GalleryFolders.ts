import type { CollectionConfig } from 'payload'
import { publicReadTenantWrite, getUserTenantID } from '../access'

/**
 * GalleryFolders — древовидные папки для группировки изображений галерей.
 * Одно видео принадлежит одной папке (поле folder в gallery-images), либо ни одной.
 *
 * `parent` и `breadcrumbs` добавляет nestedDocsPlugin (см. payload.config.ts) —
 * та же схема, что у categories. `slug` уникален в пределах родителя и тенанта.
 *
 * Намеренно лёгкая коллекция: только название, slug и дерево. Без SEO/обложек —
 * это внутренний организационный инструмент студии, не публичная таксономия.
 */
export const GalleryFolders: CollectionConfig = {
  slug: 'gallery-folders',
  labels: { singular: 'Папка галереи', plural: 'Папки галерей' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug'],
    group: 'Контент',
    description: 'Папки для группировки изображений (дерево).',
  },
  access: publicReadTenantWrite,
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Название' },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      label: 'Slug (уникален в пределах родителя)',
    },
    // `parent` и `breadcrumbs` инжектит nestedDocsPlugin.
    // `tenant` инжектит multi-tenant плагин.
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req, originalDoc }) => {
        if (!data?.slug) return data
        const tenantID =
          (data.tenant && (typeof data.tenant === 'object' ? data.tenant.id : data.tenant)) ||
          originalDoc?.tenant ||
          getUserTenantID(req.user as any)
        if (!tenantID) return data

        const parentID =
          (data.parent && (typeof data.parent === 'object' ? data.parent.id : data.parent)) ??
          originalDoc?.parent ??
          null

        const existing = await req.payload.find({
          collection: 'gallery-folders',
          where: {
            and: [
              { tenant: { equals: tenantID } },
              { slug: { equals: data.slug } },
              parentID ? { parent: { equals: parentID } } : { parent: { exists: false } },
            ],
          },
          limit: 1,
          overrideAccess: true,
          depth: 0,
        })
        const clash = existing.docs.find((d: any) => d.id !== originalDoc?.id)
        if (clash) {
          throw new Error(
            'Папка со slug "' + data.slug + '" уже существует на этом уровне вложенности.',
          )
        }
        return data
      },
    ],
  },
  timestamps: true,
}
