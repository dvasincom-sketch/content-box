import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/**
 * Журнал активности студии (пер-тенант). Кто что делал: вход, создание,
 * изменение, удаление контента. Пишется ТОЛЬКО сервером из хуков (logActivity,
 * overrideAccess) — прямой create/update закрыт. Владелец видит журнал своего
 * тенанта; может чистить (delete). Название в БД: studio_activity.
 */
const scoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true
  const t = getUserTenantID(user)
  return t ? { tenant: { equals: t } } : false
}

export const Activity: CollectionConfig = {
  slug: 'studio-activity',
  labels: { singular: 'Активность', plural: 'Активность' },
  admin: {
    useAsTitle: 'title',
    group: 'Сообщество',
    defaultColumns: ['action', 'entity', 'title', 'user', 'createdAt'],
    description: 'Журнал действий участников студии.',
  },
  access: {
    read: scoped,
    create: () => false,
    update: () => false,
    delete: ({ req: { user } }) => isSuperAdmin(user) || Boolean(getUserTenantID(user)),
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', index: true, label: 'Тенант' },
    { name: 'user', type: 'relationship', relationTo: 'users', index: true, label: 'Кто' },
    {
      name: 'action',
      type: 'select',
      label: 'Действие',
      options: [
        { label: 'Вход', value: 'login' },
        { label: 'Создание', value: 'create' },
        { label: 'Изменение', value: 'update' },
        { label: 'Удаление', value: 'delete' },
      ],
    },
    { name: 'entity', type: 'text', label: 'Объект' },
    { name: 'title', type: 'text', label: 'Название' },
  ],
  timestamps: true,
}
