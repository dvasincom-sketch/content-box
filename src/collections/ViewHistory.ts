import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/** ViewHistory — история просмотров участника (Фаза 5). Апсерт: одна строка на объект. */
const scoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user as any)) return true
  const t = getUserTenantID(user as any)
  return t ? { tenant: { equals: t } } : false
}

export const ViewHistory: CollectionConfig = {
  slug: 'views',
  labels: { singular: 'Просмотр', plural: 'История просмотров' },
  admin: { useAsTitle: 'id', group: 'Сообщество', defaultColumns: ['subscriber', 'targetType', 'viewedAt'], description: 'История просмотров участников (приватная).' },
  access: {
    read: scoped,
    create: ({ req: { user } }) => isSuperAdmin(user as any) || (user as any)?.collection === 'subscribers' || Boolean(getUserTenantID(user as any)),
    update: scoped,
    delete: scoped,
  },
  fields: [
    { name: 'subscriber', type: 'relationship', relationTo: 'subscribers', required: true, index: true, label: 'Участник' },
    {
      name: 'targetType', type: 'select', required: true, label: 'Тип',
      options: [{ label: 'Публикация', value: 'publication' }, { label: 'Видео', value: 'video' }],
      admin: { position: 'sidebar' },
    },
    { name: 'publication', type: 'relationship', relationTo: 'publications', index: true, admin: { condition: (d: any) => d?.targetType === 'publication' } },
    { name: 'video', type: 'relationship', relationTo: 'videos', index: true, admin: { condition: (d: any) => d?.targetType === 'video' } },
    { name: 'viewedAt', type: 'date', label: 'Последний просмотр', index: true },
  ],
  timestamps: true,
}
