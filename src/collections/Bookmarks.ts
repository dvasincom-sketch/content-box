import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID, isSubscriber } from '../access'

/** Bookmarks — «Посмотреть позже» участника (Фаза 5). Публикация или видео. */
const scoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true
  const t = getUserTenantID(user)
  return t ? { tenant: { equals: t } } : false
}

export const Bookmarks: CollectionConfig = {
  slug: 'bookmarks',
  labels: { singular: 'Закладка', plural: 'Закладки' },
  admin: { useAsTitle: 'id', group: 'Сообщество', defaultColumns: ['subscriber', 'targetType', 'createdAt'], description: '«Посмотреть позже» участников.' },
  access: {
    read: scoped,
    create: ({ req: { user } }) => isSuperAdmin(user) || isSubscriber(user) || Boolean(getUserTenantID(user)),
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
  ],
  timestamps: true,
}
