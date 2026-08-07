import type { Access, CollectionConfig } from 'payload'
import { awardActivity, reverseActivity } from '../lib/reputation'
import { revalidateHomeFeed } from '../lib/revalidateHome'
import { isSuperAdmin, getUserTenantID, isSubscriber } from '../access'
import { logSubscriberActivity } from '../lib/logSubscriberActivity'

/**
 * Reactions — эмодзи-реакции зрителей. Одна коллекция для двух типов целей:
 * публикация и комментарий (targetType + одно из полей publication/comment).
 *
 * Правило «один подписчик = одна реакция на объект»: хук beforeChange при
 * создании удаляет прежнюю реакцию этого подписчика на тот же объект. Значит
 * смена эмодзи = замена, повторный клик обрабатывается на уровне серверного
 * экшена (снять/поставить) — здесь гарантируется отсутствие дублей.
 *
 * Автор — из коллекции `subscribers`. Запись идёт с фронта серверным экшеном,
 * который сам берёт тенант из заголовков и вызывает Payload с overrideAccess,
 * поэтому create открыт и подписчику. Чтение/правка через REST подписчику
 * закрыты — только персоналу своего тенанта (см. ../access).
 *
 * tenant-scoped: поле `tenant` инжектит multi-tenant плагин; scoping — наши
 * access-функции (useTenantAccess:false, как во всём проекте).
 *
 * Группа админки: «Сообщество».
 */

export const REACTION_VALUES = ['like', 'love', 'fire', 'cry'] as const

const reactionsScoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true
  const tenantID = getUserTenantID(user)
  if (!tenantID) return false
  return { tenant: { equals: tenantID } }
}

export const Reactions: CollectionConfig = {
  slug: 'reactions',
  labels: { singular: 'Реакция', plural: 'Реакции' },
  admin: {
    useAsTitle: 'emoji',
    defaultColumns: ['emoji', 'targetType', 'subscriber', 'createdAt'],
    group: 'Сообщество',
    description: 'Эмодзи-реакции зрителей на публикации и комментарии.',
  },
  access: {
    read: reactionsScoped,
    create: ({ req: { user } }) => {
      if (isSuperAdmin(user)) return true
      if (isSubscriber(user)) return true
      return Boolean(getUserTenantID(user))
    },
    // Реакции не редактируются — только создаются/удаляются. update оставляем staff.
    update: reactionsScoped,
    delete: ({ req: { user } }) => {
      if (isSuperAdmin(user)) return true
      // Подписчик может снять свою реакцию (серверный экшен фильтрует по автору).
      if (isSubscriber(user)) return true
      return Boolean(getUserTenantID(user))
    },
  },
  fields: [
    {
      name: 'targetType',
      type: 'select',
      required: true,
      label: 'Тип цели',
      options: [
        { label: 'Публикация', value: 'publication' },
        { label: 'Комментарий', value: 'comment' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'publication',
      type: 'relationship',
      relationTo: 'publications',
      index: true,
      label: 'Публикация',
      admin: {
        description: 'Заполнено при targetType = публикация.',
        condition: (data: any) => data?.targetType === 'publication',
      },
    },
    {
      name: 'comment',
      type: 'relationship',
      relationTo: 'comments',
      index: true,
      label: 'Комментарий',
      admin: {
        description: 'Заполнено при targetType = комментарий.',
        condition: (data: any) => data?.targetType === 'comment',
      },
    },
    {
      name: 'subscriber',
      type: 'relationship',
      relationTo: 'subscribers',
      required: true,
      index: true,
      label: 'Подписчик',
    },
    {
      name: 'emoji',
      type: 'select',
      required: true,
      label: 'Эмодзи',
      options: [
        { label: '👍 Нравится', value: 'like' },
        { label: '❤️ Любовь', value: 'love' },
        { label: '🔥 Огонь', value: 'fire' },
        { label: '😢 Грусть', value: 'cry' },
      ],
    },
    // `tenant` инжектит multi-tenant плагин.
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        // Целостность: ровно одно из publication/comment должно быть задано,
        // согласованно с targetType.
        if (!data) return data
        if (data.targetType === 'publication') data.comment = null
        if (data.targetType === 'comment') data.publication = null
        return data
      },
    ],
    // Репутация: очки автору коммента за ПОЛУЧЕННУЮ реакцию (не за самореакцию).
    afterChange: [
      async ({ doc, req }) => {
        // Реакции на публикации меняют счётчики карточек и «популярное».
        await revalidateHomeFeed(doc?.tenant)
        if (doc?.targetType !== 'comment') return
        const commentId = doc?.comment && typeof doc.comment === 'object' ? doc.comment.id : doc?.comment
        const reactorId = doc?.subscriber && typeof doc.subscriber === 'object' ? doc.subscriber.id : doc?.subscriber
        if (!commentId) return
        const comment = await req.payload
          .findByID({ collection: 'comments', id: commentId, depth: 0, overrideAccess: true })
          .catch(() => null)
        const recipientId =
          (comment as any)?.author && typeof (comment as any).author === 'object'
            ? (comment as any).author.id
            : (comment as any)?.author
        if (!recipientId || Number(recipientId) === Number(reactorId)) return
        await awardActivity(req.payload, { subscriberId: recipientId, type: 'reaction_received', refType: 'reaction', refId: doc.id })
      },
      // Журнал действий зрителя: поставленная реакция.
      ({ doc, req, operation }) => {
        if (operation !== 'create') return
        const reactorId = doc?.subscriber && typeof doc.subscriber === 'object' ? doc.subscriber.id : doc?.subscriber
        const isComment = doc?.targetType === 'comment'
        const targetRaw = isComment ? doc?.comment : doc?.publication
        const targetId = targetRaw && typeof targetRaw === 'object' ? targetRaw.id : targetRaw
        void logSubscriberActivity(req.payload, {
          tenant: doc?.tenant,
          subscriber: reactorId,
          action: 'reaction',
          targetType: isComment ? 'comment' : 'publication',
          targetId,
          meta: doc?.emoji ? { emoji: doc.emoji } : null,
        })
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await revalidateHomeFeed(doc?.tenant)
        if (doc?.targetType !== 'comment') return
        await reverseActivity(req.payload, { type: 'reaction_received', refType: 'reaction', refId: doc.id })
      },
    ],
    beforeChange: [
      async ({ data, req, operation }) => {
        // «Один подписчик = одна реакция на объект»: при создании удаляем
        // прежнюю реакцию этого подписчика на ту же цель (замена эмодзи).
        if (operation !== 'create' || !data) return data
        const subscriberID =
          typeof data.subscriber === 'object' ? (data.subscriber as any)?.id : data.subscriber
        if (!subscriberID) return data

        const targetField = data.targetType === 'comment' ? 'comment' : 'publication'
        const targetVal = data[targetField]
        const targetID = typeof targetVal === 'object' ? (targetVal as any)?.id : targetVal
        if (!targetID) return data

        const existing = await req.payload.find({
          collection: 'reactions',
          where: {
            and: [
              { subscriber: { equals: subscriberID } },
              { [targetField]: { equals: targetID } },
            ],
          },
          depth: 0,
          limit: 100,
          overrideAccess: true,
        })
        for (const doc of (existing as any)?.docs ?? []) {
          await req.payload.delete({
            collection: 'reactions',
            id: doc.id,
            overrideAccess: true,
          })
        }
        return data
      },
    ],
  },
  timestamps: true,
}
