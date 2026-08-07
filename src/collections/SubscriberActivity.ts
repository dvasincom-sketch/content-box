import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/**
 * SubscriberActivity — журнал значимых действий зрителя (таблица
 * subscriber_activity). Служит источником для таймлайна «Действия» в правом
 * drawer дашборда (клик по пользователю).
 *
 * Пишется ТОЛЬКО сервером (overrideAccess) из центральных точек: вход,
 * регистрация, просмотр, комментарий, реакция, закладка, подписка на аккаунт,
 * изменения подписки. Помечаем осмысленные события, не каждый клик мыши.
 * Читается staff своего тенанта. Ретеншн — на будущее (крон-обрезка), сейчас
 * чтение ограничено лимитом в роуте.
 */
const scoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true
  const t = getUserTenantID(user)
  return t ? { tenant: { equals: t } } : false
}

export const SubscriberActivity: CollectionConfig = {
  slug: 'subscriber-activity',
  labels: { singular: 'Действие зрителя', plural: 'Действия зрителей' },
  admin: {
    useAsTitle: 'id',
    group: 'Сообщество',
    defaultColumns: ['subscriber', 'action', 'createdAt'],
    description: 'Журнал действий зрителей (служебное, только чтение).',
  },
  access: {
    read: scoped,
    create: () => false, // только сервер через overrideAccess
    update: () => false,
    delete: ({ req: { user } }) => isSuperAdmin(user),
  },
  fields: [
    { name: 'subscriber', type: 'relationship', relationTo: 'subscribers', required: true, index: true, label: 'Зритель' },
    {
      name: 'action',
      type: 'select',
      required: true,
      label: 'Действие',
      options: [
        { label: 'Вход', value: 'login' },
        { label: 'Регистрация', value: 'register' },
        { label: 'Просмотр', value: 'view' },
        { label: 'Комментарий', value: 'comment' },
        { label: 'Реакция', value: 'reaction' },
        { label: 'Закладка', value: 'bookmark' },
        { label: 'Подписка на аккаунт', value: 'follow' },
        { label: 'Оформил подписку', value: 'subscribe' },
        { label: 'Отменил подписку', value: 'unsubscribe' },
        { label: 'Сменил тариф', value: 'subscription_change' },
      ],
    },
    { name: 'targetType', type: 'text', label: 'Тип объекта' },
    { name: 'targetId', type: 'text', label: 'ID объекта' },
    { name: 'meta', type: 'json', label: 'Доп. данные' },
    // `tenant` НЕ инжектит плагин (нет в списке) — заводим вручную.
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', index: true, label: 'Тенант' },
  ],
  timestamps: true,
}
