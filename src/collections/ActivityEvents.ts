import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/**
 * ActivityEvents — журнал начислений очков репутации (Фаза 2 «Сообщество»).
 * Источник истины для points/level подписчика. Пишется ТОЛЬКО сервером
 * (overrideAccess) из хуков comments/reactions и бэкофилла. Читается staff.
 */
const scoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user as any)) return true
  const t = getUserTenantID(user as any)
  return t ? { tenant: { equals: t } } : false
}

export const ActivityEvents: CollectionConfig = {
  slug: 'activity-events',
  labels: { singular: 'Событие активности', plural: 'События активности' },
  admin: {
    useAsTitle: 'id',
    group: 'Сообщество',
    defaultColumns: ['subscriber', 'type', 'points', 'createdAt'],
    description: 'Журнал начислений очков (служебное, только чтение).',
  },
  access: {
    read: scoped,
    create: () => false, // только сервер через overrideAccess
    update: () => false,
    delete: ({ req: { user } }) => isSuperAdmin(user as any),
  },
  fields: [
    { name: 'subscriber', type: 'relationship', relationTo: 'subscribers', required: true, index: true, label: 'Участник' },
    {
      name: 'type',
      type: 'select',
      required: true,
      label: 'Тип',
      options: [
        { label: 'Комментарий', value: 'comment' },
        { label: 'Полученная реакция', value: 'reaction_received' },
      ],
    },
    { name: 'points', type: 'number', required: true, label: 'Очки' },
    { name: 'refType', type: 'text', label: 'Тип объекта' },
    { name: 'refId', type: 'text', label: 'ID объекта' },
    // `tenant` инжектит multi-tenant плагин.
  ],
  timestamps: true,
}
