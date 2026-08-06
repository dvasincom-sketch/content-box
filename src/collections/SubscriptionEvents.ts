import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/**
 * Журнал событий подписок (пер-тенант). Фиксирует коммерческие переходы
 * подписчиков: оформил / продлил / сменил тариф / отменил. Нужен для
 * дашборда — конверсия и платные пользователи «в динамике» (истории в
 * subscribers нет, там только текущее состояние).
 *
 * Пишется ТОЛЬКО сервером из хука Subscribers.afterChange (overrideAccess) —
 * прямой create/update закрыт. Цена и название тарифа сохраняются снимком,
 * чтобы график не «поехал» при изменении/удалении тарифа. Таблица в БД:
 * subscription_events. Тенант — ручное поле (в multi-tenant плагин не включаем,
 * как и studio-activity).
 */
const scoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true
  const t = getUserTenantID(user)
  return t ? { tenant: { equals: t } } : false
}

export const SubscriptionEvents: CollectionConfig = {
  slug: 'subscription-events',
  labels: { singular: 'Событие подписки', plural: 'События подписок' },
  admin: {
    useAsTitle: 'tierName',
    group: 'Управление',
    defaultColumns: ['action', 'tierName', 'priceRub', 'subscriber', 'createdAt'],
    description: 'Журнал оформлений и продлений подписок (для аналитики).',
  },
  access: {
    read: scoped,
    create: () => false,
    update: () => false,
    delete: ({ req: { user } }) => isSuperAdmin(user) || Boolean(getUserTenantID(user)),
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', index: true, label: 'Тенант' },
    { name: 'subscriber', type: 'relationship', relationTo: 'subscribers', index: true, label: 'Подписчик' },
    { name: 'tier', type: 'relationship', relationTo: 'subscription-tiers', label: 'Тариф' },
    { name: 'tierName', type: 'text', label: 'Тариф (снимок)' },
    { name: 'priceRub', type: 'number', label: 'Цена, ₽ (снимок)' },
    {
      name: 'action',
      type: 'select',
      label: 'Событие',
      options: [
        { label: 'Оформил', value: 'started' },
        { label: 'Продлил', value: 'renewed' },
        { label: 'Сменил тариф', value: 'changed' },
        { label: 'Отменил', value: 'canceled' },
      ],
    },
  ],
  timestamps: true,
}
