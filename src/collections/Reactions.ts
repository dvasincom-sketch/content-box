import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/**
 * Reactions — эмодзи-реакции зрителей. Одна коллекция для двух типов целей:
 * публикация и комментарий (targetType + одно из полей publication/comment).
 *
 * Правило «один подписчик = одна реакция на объект»: хук beforeChange при
 * создании удаляет прежнюю реакцию этого подписчика на тот же объект. Значит
 * смена эмодзи = замена, повторный клик обрабатывается на уровне серверного
 * экшена (снять/поставить) — здесь гарантируется отсутствие дублей.
 *
 * Автор — из коллекции `subscribers`. Запись идёт с фронта серверным экшеном
 * под залогиненным подписчиком (overrideAccess:false), поэтому create открыт
 * и подписчику.
 *
 * tenant-scoped: поле `tenant` инжектит multi-tenant плагин; scoping — наши
 * access-функции (useTenantAccess:false, как во всём проекте).
 *
 * Группа админки: «Сообщество».
 */

export const REACTION_VALUES = ['like', 'love', 'fire', 'cry'] as const

const reactionsScoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user as any)) return true
  const tenantID = getUserTenantID(user as any)
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
      if (isSuperAdmin(user as any)) return true
      if ((user as any)?.collection === 'subscribers') return true
      return Boolean(getUserTenantID(user as any))
    },
    // Реакции не редактируются — только создаются/удаляются. update оставляем staff.
    update: reactionsScoped,
    delete: ({ req: { user } }) => {
      if (isSuperAdmin(user as any)) return true
      // Подписчик может снять свою реакцию (серверный экшен фильтрует по автору).
      if ((user as any)?.collection === 'subscribers') return true
      return Boolean(getUserTenantID(user as any))
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
            id: (doc as any).id,
            overrideAccess: true,
          })
        }
        return data
      },
    ],
  },
  timestamps: true,
}
