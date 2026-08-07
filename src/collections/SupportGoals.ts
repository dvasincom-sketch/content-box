import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/**
 * SupportGoals — цели сбора для страницы «Поддержать проект» (пер-тенант).
 * Цель = название + описание + сумма-цель (₽) + собрано (₽). «Собрано» пока
 * задаётся вручную/сидом; позже будет инкрементироваться из платежей YooKassa.
 * Тенант — ручное поле (в multi-tenant плагин не включаем, как subscription-events).
 * Таблица: support_goals. Группа админки: «Управление».
 */
const scoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true
  const t = getUserTenantID(user)
  return t ? { tenant: { equals: t } } : false
}

export const SupportGoals: CollectionConfig = {
  slug: 'support-goals',
  labels: { singular: 'Цель сбора', plural: 'Цели сбора' },
  admin: {
    useAsTitle: 'title',
    group: 'Управление',
    defaultColumns: ['title', 'targetRub', 'raisedRub', 'isActive', 'weight'],
    description: 'Цели для страницы «Поддержать проект».',
  },
  access: {
    read: scoped,
    create: ({ req: { user } }) => isSuperAdmin(user) || Boolean(getUserTenantID(user)),
    update: scoped,
    delete: scoped,
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', index: true, label: 'Тенант' },
    { name: 'title', type: 'text', required: true, label: 'Название цели' },
    { name: 'description', type: 'textarea', label: 'Описание' },
    { name: 'targetRub', type: 'number', required: true, min: 0, label: 'Цель, ₽' },
    { name: 'raisedRub', type: 'number', defaultValue: 0, min: 0, label: 'Собрано, ₽' },
    { name: 'weight', type: 'number', defaultValue: 0, label: 'Порядок (меньше — выше)' },
    { name: 'isActive', type: 'checkbox', defaultValue: true, label: 'Активна' },
    { name: 'slug', type: 'text', index: true, label: 'Slug' },
  ],
  timestamps: true,
}
