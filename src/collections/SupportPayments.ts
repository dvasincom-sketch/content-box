import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/**
 * SupportPayments — платежи поддержки (донаты) для страницы «Поддержать проект».
 * Пер-тенант. Платёж = сумма (₽) + опц. цель + опц. пользователь + слова
 * поддержки + флаг анонимности. Пишется сервером (сид сейчас; позже —
 * вебхук YooKassa после успешной оплаты). Прямой create/update закрыт.
 * Таблица: support_payments. Группа админки: «Управление».
 */
const scoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true
  const t = getUserTenantID(user)
  return t ? { tenant: { equals: t } } : false
}

export const SupportPayments: CollectionConfig = {
  slug: 'support-payments',
  labels: { singular: 'Платёж поддержки', plural: 'Платежи поддержки' },
  admin: {
    useAsTitle: 'displayName',
    group: 'Управление',
    defaultColumns: ['displayName', 'amountRub', 'goal', 'status', 'createdAt'],
    description: 'Донаты со страницы «Поддержать проект».',
  },
  access: {
    read: scoped,
    create: () => false,
    update: () => false,
    delete: ({ req: { user } }) => isSuperAdmin(user) || Boolean(getUserTenantID(user)),
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', index: true, label: 'Тенант' },
    { name: 'goal', type: 'relationship', relationTo: 'support-goals', index: true, label: 'Цель (пусто = проект в целом)' },
    { name: 'user', type: 'relationship', relationTo: 'users', index: true, label: 'Пользователь' },
    { name: 'displayName', type: 'text', label: 'Имя для показа' },
    { name: 'amountRub', type: 'number', required: true, min: 0, label: 'Сумма, ₽' },
    { name: 'message', type: 'textarea', label: 'Слова поддержки' },
    { name: 'isAnonymous', type: 'checkbox', defaultValue: false, label: 'Анонимно' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'succeeded',
      label: 'Статус',
      options: [
        { label: 'Ожидает', value: 'pending' },
        { label: 'Успешно', value: 'succeeded' },
        { label: 'Отменён', value: 'canceled' },
      ],
    },
  ],
  timestamps: true,
}
