import type { CollectionConfig } from 'payload'
import { OverviewField, PreviewField } from '@payloadcms/plugin-seo/fields'
import { publicReadTenantWrite, getUserTenantID } from '../access'
import { extractLexicalText, truncateAtWord } from '../utils/lexicalText'

/**
 * Categories (ТЗ §3.4) — древовидная таксономия, tenant-scoped.
 * `parent` и `breadcrumbs` добавляет nestedDocsPlugin (см. payload.config.ts):
 * он же рекурсивно обновляет потомков при смене родителя.
 * `slug` уникален В ПРЕДЕЛАХ РОДИТЕЛЯ: «Members» может быть и в BTS, и в Galleries.
 *
 * SEO: группа `seo` — ручные оверрайды. Если поля пусты, хук `beforeChange`
 * заполняет их автоматически из fullTitle/title и description.
 * OverviewField/PreviewField дают визуальный аудит (длина, сниппет выдачи).
 * targetKeywords — целевые поисковые запросы (импорт из Wordstat или вручную).
 */

const SEO_TITLE_MAX = 60
const SEO_DESC_MAX = 160
const SITE_NAME = 'COCO JAMBO'

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'Категория', plural: 'Категории' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['fullTitle', 'slug', 'showInHeader', 'order'],
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
      admin: {
        description:
          'Пусто = сгенерируется автоматически из названия и описания при сохранении.',
      },
      fields: [
        OverviewField({
          titlePath: 'seo.title',
          descriptionPath: 'seo.description',
          imagePath: 'seo.ogImage',
        }),
        {
          name: 'title',
          type: 'text',
          label: 'SEO Title',
          admin: { description: 'Рекомендуется до 60 символов.' },
        },
        {
          name: 'description',
          type: 'textarea',
          label: 'SEO Description',
          admin: { description: 'Рекомендуется до 160 символов.' },
        },
        { name: 'ogImage', type: 'upload', relationTo: 'media', label: 'OG-изображение' },
        {
          name: 'targetKeywords',
          type: 'array',
          label: 'Целевые запросы',
          admin: {
            description:
              'Ключевые поисковые запросы для этой страницы. Заполняется вручную или импортом из Wordstat.',
            initCollapsed: true,
          },
          fields: [
            {
              name: 'keyword',
              type: 'text',
              required: true,
            },
          ],
        },
        PreviewField({
          titlePath: 'seo.title',
          descriptionPath: 'seo.description',
        }),
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
            'Категория со slug "' + data.slug + '" уже существует на этом уровне вложенности.',
          )
        }
        return data
      },
    ],
    beforeChange: [
      ({ data }) => {
        if (!data) return data
        const seo = (data as any).seo || ((data as any).seo = {})

        if (!seo.title) {
          const base = (data as any).fullTitle || (data as any).title
          if (base) {
            const suffix = ' | ' + SITE_NAME
            const room = SEO_TITLE_MAX - suffix.length
            seo.title = truncateAtWord(String(base), room) + suffix
          }
        }

        if (!seo.description) {
          const text = extractLexicalText((data as any).description)
          if (text) {
            seo.description = truncateAtWord(text, SEO_DESC_MAX)
          }
        }

        return data
      },
    ],
  },
  timestamps: true,
}
