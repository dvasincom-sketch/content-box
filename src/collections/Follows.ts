import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/** Follows — подписки участников друг на друга (Фаза 5). follower → following. */
const scoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user as any)) return true
  const t = getUserTenantID(user as any)
  return t ? { tenant: { equals: t } } : false
}

export const Follows: CollectionConfig = {
  slug: 'follows',
  labels: { singular: 'Подписка', plural: 'Подписки (на аккаунты)' },
  admin: { useAsTitle: 'id', group: 'Сообщество', defaultColumns: ['follower', 'following', 'createdAt'], description: 'Кто на кого подписан.' },
  access: {
    read: scoped,
    create: ({ req: { user } }) => isSuperAdmin(user as any) || (user as any)?.collection === 'subscribers' || Boolean(getUserTenantID(user as any)),
    update: scoped,
    delete: scoped,
  },
  fields: [
    { name: 'follower', type: 'relationship', relationTo: 'subscribers', required: true, index: true, label: 'Подписчик' },
    { name: 'following', type: 'relationship', relationTo: 'subscribers', required: true, index: true, label: 'На кого подписан' },
  ],
  timestamps: true,
}
