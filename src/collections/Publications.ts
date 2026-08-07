import type { CollectionConfig } from 'payload'
import { contentAccess, ownerField, stampOwner, getUserTenantID } from '../access'
import { activityAfterChange, activityAfterDelete } from '../lib/logActivity'
import { revalidateHomeFeed } from '../lib/revalidateHome'
import { tagsField, normalizeTags } from '../fields/tags'

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
  labels: { singular: 'Публикация', plural: 'Публикации' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'publishedAt', 'featured', 'isNews'],
  },
  access: contentAccess('posts'),
  fields: [
    // `tenant` added by the multi-tenant plugin.
    ownerField,
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
    { name: 'category', type: 'relationship', relationTo: 'categories', label: 'Основная категория' },
    {
      // Дополнительные категории: публикация показывается и в них, но основной
      // остаётся `category` выше (крошки, каноничный путь). Листинги категорий
      // учитывают и основную, и дополнительные.
      name: 'extraCategories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      label: 'Дополнительные категории',
      admin: {
        description: 'Публикация появится и в этих разделах. Основная категория — отдельное поле выше.',
      },
    },
    {
      // Связка «Мир BTS» → «Смотреть». Статья-энциклопедия ссылается на
      // категорию из блока «Смотреть» с видео по теме: читатель из органики
      // сразу уходит смотреть. Связь 1:1 (одна категория — максимум одна
      // статья) держится хуком ниже + уникальным индексом в БД
      // (см. миграцию add_publication_watch_category).
      // `category` выше — СВОЁ место статьи в дереве «Мира BTS»; это поле —
      // ссылка НА ДРУГУЮ ветку, не путать.
      name: 'watchCategory',
      type: 'relationship',
      relationTo: 'categories',
      label: 'Связка со «Смотреть»',
      admin: {
        description:
          'Категория из блока «Смотреть» с видео по теме этой статьи. Связь 1:1 — категорию нельзя привязать к двум статьям.',
      },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'subscribers',
      label: 'Автор-участник',
      admin: { description: 'Публикации сообщества (UGC). Пусто = материал редакции.' },
    },
    {
      name: 'section',
      type: 'select',
      defaultValue: 'feed',
      label: 'Раздел',
      options: [
        { label: 'Общая лента', value: 'feed' },
        { label: 'Сообщество', value: 'community' },
      ],
      admin: { description: 'Сообщество — материалы участников; в главной ленте не показываются.' },
    },
    {
      name: 'minTier',
      type: 'relationship',
      relationTo: 'subscription-tiers',
      label: 'Минимальный уровень доступа',
      admin: {
        description: 'Пусто = доступно всем бесплатно. Иначе — от этого уровня и выше.',
      },
    },
    {
      name: 'relatedVideos',
      type: 'relationship',
      relationTo: 'videos',
      hasMany: true,
      label: 'Прикреплённые видео',
      admin: {
        description: 'Видео, показываемые в публикации (до описания). Доступ каждого — по его собственному уровню.',
      },
    },
    {
      name: 'gallery',
      type: 'array',
      label: 'Галерея',
      labels: { singular: 'Изображение', plural: 'Изображения' },
      admin: {
        description: 'Фото-галерея публикации. Доступна по уровню самой публикации (minTier).',
      },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'gallery-images',
          required: true,
          label: 'Изображение',
        },
        { name: 'caption', type: 'text', label: 'Подпись' },
      ],
    },
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
      name: 'isNews',
      type: 'checkbox',
      defaultValue: false,
      label: 'Новость',
      index: true,
      admin: {
        description: 'Отметьте, если это новость о событиях во вселенной BTS. Такие материалы попадают в секцию «Новости» на главной.',
      },
    },
    {
      name: 'isNew',
      type: 'checkbox',
      defaultValue: false,
      label: 'Новинка',
      index: true,
      admin: {
        description: 'Публикация 14 дней висит в разделе «Новинки», затем остаётся только в своих категориях. Окно (newUntil) проставляется автоматически.',
      },
    },
    {
      // Момент, до которого публикация считается «новинкой». Ставится хуком по
      // флагу isNew (сейчас + 14 дней), обнуляется при снятии флага. Витрина
      // «Новинки» показывает публикации с isNew && newUntil > now.
      name: 'newUntil',
      type: 'date',
      label: 'Новинка до',
      index: true,
      admin: {
        readOnly: true,
        description: 'Заполняется автоматически от флага «Новинка».',
      },
    },
    tagsField,
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
      // Связь «Смотреть» ↔ «Мир BTS» — строго 1:1. Дружелюбная ошибка ДО того,
      // как сработает уникальный индекс в БД (тот даёт непонятное 23505).
      async ({ data, req, originalDoc }) => {
        const rel = data?.watchCategory
        const watchCatID =
          rel && (typeof rel === 'object' ? (rel as any).id : rel)
        if (!watchCatID) return data
        const tenantID =
          (data?.tenant &&
            (typeof data.tenant === 'object' ? data.tenant.id : data.tenant)) ||
          originalDoc?.tenant ||
          getUserTenantID(req.user as any)
        if (!tenantID) return data

        const existing = await req.payload.find({
          collection: 'publications',
          where: {
            and: [
              { tenant: { equals: tenantID } },
              { watchCategory: { equals: watchCatID } },
            ],
          },
          limit: 1,
          overrideAccess: true,
          depth: 0,
        })
        const clash = existing.docs.find((d: any) => d.id !== originalDoc?.id)
        if (clash) {
          throw new Error(
            'Эта категория «Смотреть» уже связана с другой публикацией (связь 1:1). ' +
              'Снимите связку у той статьи или выберите другую категорию.',
          )
        }
        return data
      },
    ],
    beforeChange: [
      // Владелец при создании (страховка к явной простановке в studio-роуте).
      stampOwner,
      // Свободные теги: тримим label и считаем slug (slugify), убираем дубли.
      ({ data }) => normalizeTags(data),
      // Окно «Новинки»: при включении флага ставим newUntil = сейчас + 14 дней;
      // при снятии — обнуляем. Повторное сохранение уже активной новинки срок
      // НЕ продлевает (окно фиксируется от момента отметки).
      ({ data, originalDoc }) => {
        if (!data) return data
        const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000
        if (data.isNew) {
          const wasNew = Boolean(originalDoc?.isNew)
          const prevUntil = originalDoc?.newUntil ? new Date(originalDoc.newUntil).getTime() : 0
          if (!wasNew || !prevUntil || prevUntil < Date.now()) {
            data.newUntil = new Date(Date.now() + NEW_WINDOW_MS).toISOString()
          }
        } else {
          data.newUntil = null
        }
        return data
      },
    ],
    // Состав секций главной зависит от публикаций — сбрасываем кэш ленты
    // тенанта. Тег точечный, соседние сайты не затрагиваются.
    afterChange: [async ({ doc, req }) => { await revalidateHomeFeed(doc?.tenant ?? getUserTenantID(req.user as any)) }, activityAfterChange('publication')],
    afterDelete: [async ({ doc }) => { await revalidateHomeFeed(doc?.tenant) }, activityAfterDelete('publication')],
  },
  timestamps: true,
}
