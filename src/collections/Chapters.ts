import type { CollectionConfig } from 'payload'
import { contentAccess, ownerField, stampOwner } from '../access'

/**
 * Chapters («Главы») — главы книги (коллекция `books`). Текст в Lexical.
 *
 * Порядок глав — поле `order` (число). Доступ главы вычисляется вместе с
 * книгой (см. src/lib/chapterAccess.ts): бесплатна, если isPreview, либо входит
 * в первые `book.freeChapters`, либо у книги/главы нет minTier; иначе — по
 * подписке. `minTier` на главе — необязательное переопределение уровня книги.
 *
 * `tenant` инжектит multi-tenant плагин.
 */
export const Chapters: CollectionConfig = {
  slug: 'chapters',
  labels: { singular: 'Глава', plural: 'Главы' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'book', 'order', 'isPreview', 'updatedAt'],
    group: 'Контент',
    description: 'Главы книг (текст).',
  },
  access: contentAccess('books'),
  hooks: {
    beforeChange: [stampOwner],
  },
  fields: [
    // `tenant` добавляет multi-tenant плагин.
    ownerField,
    {
      name: 'book',
      type: 'relationship',
      relationTo: 'books',
      required: true,
      label: 'Книга',
    },
    { name: 'order', type: 'number', label: 'Порядок', defaultValue: 1, admin: { description: 'Номер главы для сортировки.' } },
    { name: 'title', type: 'text', required: true, label: 'Заголовок главы' },
    { name: 'body', type: 'richText', label: 'Текст главы' },
    {
      name: 'isPreview',
      type: 'checkbox',
      defaultValue: false,
      label: 'Бесплатная глава',
      admin: { description: 'Открыта всем, независимо от уровня книги.' },
    },
    {
      name: 'minTier',
      type: 'relationship',
      relationTo: 'subscription-tiers',
      label: 'Уровень подписки (переопределение)',
      admin: { description: 'Пусто — берётся уровень книги.' },
    },
    { name: 'wordCount', type: 'number', label: 'Слов', admin: { readOnly: true } },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Дата публикации',
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
  ],
  timestamps: true,
}
