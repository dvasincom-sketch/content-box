import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/**
 * Comments — комментарии зрителей под публикациями.
 *
 * Постмодерация: коммент публикуется сразу (status='published'), staff может
 * скрыть (status='hidden') или удалить постфактум. Публично читаются только
 * published. Автор — из коллекции `subscribers` (зрители, НЕ CMS-users).
 *
 * Ветки — ОДИН уровень: ответ ссылается на корневой коммент через `parent`.
 * Ответ на ответ запрещён (hook ниже проверяет, что parent сам не имеет parent).
 *
 * Запись комментариев идёт с фронта через серверный экшен под залогиненным
 * подписчиком (overrideAccess: false), поэтому create разрешён и подписчику.
 *
 * tenant-scoped: плагин multi-tenant инжектит поле `tenant`; scoping делают
 * наши access-функции (как во всём проекте, useTenantAccess:false).
 *
 * Группа админки: «Сообщество».
 */

const commentsScoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user as any)) return true
  const tenantID = getUserTenantID(user as any)
  if (!tenantID) return false
  return { tenant: { equals: tenantID } }
}

export const Comments: CollectionConfig = {
  slug: 'comments',
  labels: { singular: 'Комментарий', plural: 'Комментарии' },
  admin: {
    useAsTitle: 'text',
    defaultColumns: ['text', 'author', 'publication', 'status', 'createdAt'],
    group: 'Сообщество',
    description: 'Комментарии зрителей. Постмодерация: скрывайте нарушающие через статус.',
  },
  access: {
    // Чтение в CMS — только staff своего тенанта. Публичное чтение на фронте
    // идёт через overrideAccess в серверной выборке с фильтром status=published.
    read: commentsScoped,
    // Создание: staff тенанта ИЛИ залогиненный подписчик (через серверный экшен).
    create: ({ req: { user } }) => {
      if (isSuperAdmin(user as any)) return true
      if ((user as any)?.collection === 'subscribers') return true
      return Boolean(getUserTenantID(user as any))
    },
    // Правка/удаление — staff (модерация). Подписчик не редактирует через CMS.
    update: commentsScoped,
    delete: commentsScoped,
  },
  fields: [
    {
      name: 'publication',
      type: 'relationship',
      relationTo: 'publications',
      required: true,
      index: true,
      label: 'Публикация',
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'subscribers',
      required: true,
      index: true,
      label: 'Автор',
      admin: { description: 'Зритель, оставивший комментарий.' },
    },
    {
      name: 'text',
      type: 'textarea',
      required: true,
      label: 'Текст',
      maxLength: 2000,
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'comments',
      label: 'Ответ на',
      index: true,
      admin: {
        description: 'Заполнено = это ответ. Ветки только один уровень.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'published',
      label: 'Статус',
      options: [
        { label: 'Опубликован', value: 'published' },
        { label: 'Скрыт', value: 'hidden' },
      ],
      admin: {
        description: 'Скрытые комментарии не видны на сайте.',
        position: 'sidebar',
      },
    },
    // `tenant` инжектит multi-tenant плагин.
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        // Ветки — один уровень: если задан parent, он сам не должен иметь parent.
        if (!data?.parent) return data
        const parentID =
          typeof data.parent === 'object' ? (data.parent as any).id : data.parent
        const parent = await req.payload.findByID({
          collection: 'comments',
          id: parentID,
          depth: 0,
          overrideAccess: true,
        })
        if ((parent as any)?.parent) {
          throw new Error('Ответы допускаются только на корневой комментарий (один уровень).')
        }
        return data
      },
    ],
  },
  timestamps: true,
}
