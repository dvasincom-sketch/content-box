import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID, isSubscriber } from '../access'

/**
 * Submissions — присланные участниками публикации на модерацию (Фаза 4 UGC).
 * Живут ОТДЕЛЬНО от publications, поэтому неодобренный контент никогда не течёт
 * в паблик-ленту. При одобрении создаётся `publication` (см. Студию → Модерация).
 * Создавать может залогиненный подписчик (через серверный экшен) и staff.
 */
const scoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true
  const t = getUserTenantID(user)
  return t ? { tenant: { equals: t } } : false
}

export const Submissions: CollectionConfig = {
  slug: 'submissions',
  labels: { singular: 'Заявка', plural: 'Заявки (UGC)' },
  admin: {
    useAsTitle: 'title',
    group: 'Сообщество',
    defaultColumns: ['title', 'author', 'status', 'createdAt'],
    description: 'Публикации от участников на модерации.',
  },
  access: {
    read: scoped,
    create: ({ req: { user } }) => {
      if (isSuperAdmin(user)) return true
      if (isSubscriber(user)) return true
      return Boolean(getUserTenantID(user))
    },
    update: scoped,
    delete: scoped,
  },
  fields: [
    { name: 'author', type: 'relationship', relationTo: 'subscribers', required: true, index: true, label: 'Автор' },
    { name: 'title', type: 'text', required: true, label: 'Заголовок' },
    { name: 'body', type: 'richText', label: 'Текст' },
    { name: 'category', type: 'relationship', relationTo: 'categories', label: 'Категория' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      label: 'Статус',
      options: [
        { label: 'На модерации', value: 'pending' },
        { label: 'Одобрена', value: 'approved' },
        { label: 'Отклонена', value: 'rejected' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'section',
      type: 'select',
      label: 'Раздел (при одобрении)',
      options: [
        { label: 'Общая лента', value: 'feed' },
        { label: 'Сообщество', value: 'community' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'rejectReason', type: 'textarea', label: 'Причина отклонения' },
    { name: 'reviewedBy', type: 'relationship', relationTo: 'users', label: 'Проверил' },
    { name: 'publication', type: 'relationship', relationTo: 'publications', label: 'Созданная публикация' },
    // `tenant` инжектит multi-tenant плагин.
  ],
  timestamps: true,
}
