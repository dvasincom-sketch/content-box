import type { CollectionConfig } from 'payload'
import { publicReadTenantWrite, getUserTenantID } from '../access'

/**
 * Categories (ТЗ §3.4) — древовидная таксономия, tenant-scoped.
 * `parent` и `breadcrumbs` добавляет nestedDocsPlugin (см. payload.config.ts):
 * он же рекурсивно обновляет потомков при смене родителя.
 * `slug` уникален В ПРЕДЕЛАХ РОДИТЕЛЯ: «Members» может быть и в BTS, и в Galleries.
 */
export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'Категория', plural: 'Категории' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['fullTitle', 'slug', 'showInHeader', 'order'],
  },
  access: publicReadTenantWrite,
  fields: [
    // `tenant` добавляет multi-tenant плагин.
    // `parent` и `breadcrumbs` добавляет nested-docs плагин.
    { name: 'title', type: 'text', required: true, label: 'Название' },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      label: 'Slug (уникален в пределах родителя)',
    },
    {
      name: 'fullTitle',
      type: 'text',
      label: 'Полное название',
      admin: {
        readOnly: true,
        description: 'Дискография > Chapter 1 > School Trilogy',
      },
      hooks: {
        beforeChange: [
          ({ data }) => {
            const crumbs = (data as any)?.breadcrumbs
            if (!Array.isArray(crumbs) || crumbs.length === 0) return (data as any)?.title
            return crumbs.map((c: any) => c.label).join(' > ')
          },
        ],
      },
    },
    { name: 'cover', type: 'upload', relationTo: 'media', label: 'Обложка' },
    {
      name: 'description',
      type: 'richText',
      label: 'Описание',
      admin: { description: 'Текст над списком публикаций. Можно оставить пустым.' },
    },
    { name: 'order', type: 'number', defaultValue: 0, label: 'Сортировка' },
    {
      name: 'showInHeader',
      type: 'checkbox',
      defaultValue: false,
      label: 'В меню шапки',
      admin: { description: 'Только для категорий верхнего уровня.' },
    },
    {
      name: 'showInFooter',
      type: 'checkbox',
      defaultValue: false,
      label: 'В футере',
      admin: { description: 'Показывать в колонке футера (для подкатегорий 2-го уровня).' },
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
          (data.tenant && (typeof data.tenant === 'object' ? data.tenant.id : data.tenant)) ||
          originalDoc?.tenant ||
          getUserTenantID(req.user as any)
        if (!tenantID) return data

        // Уникальность slug в пределах родителя (дерево).
        const parentID =
          (data.parent && (typeof data.parent === 'object' ? data.parent.id : data.parent)) ??
          originalDoc?.parent ??
          null

        const existing = await req.payload.find({
          collection: 'categories',
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
            `Категория со slug "${data.slug}" уже существует на этом уровне вложенности.`,
          )
        }
        return data
      },
    ],
  },
  timestamps: true,
}
