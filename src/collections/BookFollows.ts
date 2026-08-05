import type { CollectionConfig } from 'payload'
import { tenantScopedCollection } from '../access'

/**
 * BookFollows — «следить за книгой»: читатель подписывается на обновления
 * произведения и получает новые главы в дайджесте. Отдельная лёгкая коллекция
 * (не член-follows, где follower→following оба subscribers): здесь цель — книга.
 *
 * Уникальность (один читатель = одна подписка на книгу) держит частичный
 * unique-индекс в миграции. `tenant` инжектит multi-tenant плагин.
 */
export const BookFollows: CollectionConfig = {
  slug: 'book-follows',
  labels: { singular: 'Подписка на книгу', plural: 'Подписки на книги' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['subscriber', 'book', 'createdAt'],
    group: 'Сообщество',
    description: 'Читатели, следящие за обновлениями произведений.',
  },
  access: tenantScopedCollection,
  fields: [
    // `tenant` инжектит multi-tenant плагин.
    { name: 'subscriber', type: 'relationship', relationTo: 'subscribers', required: true, index: true, label: 'Читатель' },
    { name: 'book', type: 'relationship', relationTo: 'books', required: true, index: true, label: 'Книга' },
  ],
  timestamps: true,
}
