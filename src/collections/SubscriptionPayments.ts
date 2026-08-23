import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/**
 * SubscriptionPayments — история платежей по подпискам (ЮKassa, Вариант 1).
 * Пишет ТОЛЬКО сервер (вебхук/крон) через overrideAccess. Читает владелец
 * (аналитика) и подписчик своё (через сервер). `yookassaPaymentId` уникально
 * используется для идемпотентности вебхука (повторные уведомления ЮKassa).
 */
const scoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true
  const t = getUserTenantID(user)
  return t ? { tenant: { equals: t } } : false
}

export const SubscriptionPayments: CollectionConfig = {
  slug: 'subscription-payments',
  labels: { singular: 'Платёж подписки', plural: 'Платежи подписок' },
  admin: {
    useAsTitle: 'yookassaPaymentId',
    group: 'Служебное',
    defaultColumns: ['subscriber', 'amountRub', 'status', 'isRecurring', 'createdAt'],
    description: 'История платежей подписок (служебное, только чтение).',
  },
  access: {
    read: scoped,
    create: () => false, // только сервер через overrideAccess
    update: () => false,
    delete: ({ req: { user } }) => isSuperAdmin(user),
  },
  fields: [
    { name: 'subscriber', type: 'relationship', relationTo: 'subscribers', label: 'Подписчик' },
    { name: 'tier', type: 'relationship', relationTo: 'subscription-tiers', label: 'Уровень' },
    { name: 'amountRub', type: 'number', label: 'Сумма, ₽', defaultValue: 0 },
    {
      name: 'status',
      type: 'select',
      label: 'Статус',
      defaultValue: 'pending',
      options: [
        { label: 'Ожидает', value: 'pending' },
        { label: 'Оплачен', value: 'succeeded' },
        { label: 'Отменён', value: 'canceled' },
        { label: 'Возврат', value: 'refunded' },
      ],
    },
    { name: 'yookassaPaymentId', type: 'text', label: 'ID платежа ЮKassa', index: true },
    { name: 'isRecurring', type: 'checkbox', label: 'Автосписание', defaultValue: false },
    // `tenant` инжектит multi-tenant плагин.
  ],
  timestamps: true,
}
