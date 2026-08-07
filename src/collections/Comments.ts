import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID, isSubscriber } from '../access'
import { awardActivity, reverseActivity } from '../lib/reputation'
import { revalidateHomeFeed } from '../lib/revalidateHome'
import { logSubscriberActivity } from '../lib/logSubscriberActivity'

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
 * Запись комментариев идёт с фронта серверным экшеном, который сам берёт
 * тенант из заголовков и вызывает Payload с overrideAccess, поэтому create
 * разрешён и подписчику. Читать/править/удалять комментарии через REST
 * подписчик НЕ может — только персонал своего тенанта (см. ../access).
 *
 * tenant-scoped: плагин multi-tenant инжектит поле `tenant`; scoping делают
 * наши access-функции (как во всём проекте, useTenantAccess:false).
 *
 * Группа админки: «Сообщество».
 */

const commentsScoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true
  const tenantID = getUserTenantID(user)
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
      if (isSuperAdmin(user)) return true
      if (isSubscriber(user)) return true
      return Boolean(getUserTenantID(user))
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
      index: true,
      label: 'Публикация',
      admin: { description: 'Заполнено у комментария к публикации (иначе — к главе).' },
    },
    {
      name: 'chapter',
      type: 'relationship',
      relationTo: 'chapters',
      index: true,
      label: 'Глава',
      admin: { description: 'Заполнено у комментария к главе книги.' },
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
    // Репутация: очки автору за ОПУБЛИКОВАННЫЙ коммент; откат при скрытии/удалении.
    afterChange: [
      async ({ doc, req }) => {
        const authorId = doc?.author && typeof doc.author === 'object' ? doc.author.id : doc?.author
        if (doc?.status === 'published') {
          await awardActivity(req.payload, { subscriberId: authorId, type: 'comment', refType: 'comment', refId: doc.id })
        } else {
          await reverseActivity(req.payload, { type: 'comment', refType: 'comment', refId: doc.id })
        }
        // Комментарии влияют на счётчики карточек и секции «популярное»
        // и «обсуждаемое» — лента тенанта устарела.
        await revalidateHomeFeed(doc?.tenant)
      },
      // Журнал действий зрителя: новый опубликованный комментарий.
      ({ doc, req, operation }) => {
        if (operation !== 'create' || doc?.status !== 'published') return
        const authorId = doc?.author && typeof doc.author === 'object' ? doc.author.id : doc?.author
        const targetId = doc?.publication && typeof doc.publication === 'object' ? doc.publication.id : doc?.publication
        const text = typeof doc?.text === 'string' ? doc.text.slice(0, 120) : null
        void logSubscriberActivity(req.payload, {
          tenant: doc?.tenant,
          subscriber: authorId,
          action: 'comment',
          targetType: targetId ? 'publication' : (doc?.chapter ? 'chapter' : null),
          targetId: targetId ?? (doc?.chapter && typeof doc.chapter === 'object' ? doc.chapter.id : doc?.chapter),
          meta: text ? { preview: text } : null,
        })
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await reverseActivity(req.payload, { type: 'comment', refType: 'comment', refId: doc.id })
        await revalidateHomeFeed(doc?.tenant)
      },
    ],
  },
  timestamps: true,
}
