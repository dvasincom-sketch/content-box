import type { CollectionConfig } from 'payload'
import { ownerScopedCollection, ownerField, stampOwner } from '../access'
import { activityAfterChange, activityAfterDelete } from '../lib/logActivity'

/**
 * Downloads («Файлы») — цифровые товары под подписку: книги, PDF, архивы,
 * пресеты и т.п. (раздел «Медиа» → «Файлы»).
 *
 * Отдельная upload-коллекция (не media/gallery-images), чтобы товары для
 * скачивания не смешивались с обложками и фото галерей и имели собственные
 * поля доступа (minTier / isPreview) и категорию.
 *
 * Гейтинг «мягкий, но реальный»: сам файл лежит в S3 (привязка в
 * payload.config.ts, s3Storage — рядом с media/gallery), а на сайт прямой URL
 * НЕ отдаётся. Скачивание идёт через защищённый роут `/api/download/[id]`,
 * который сперва проверяет подписку (checkDownloadAccess), а затем стримит
 * файл. Клиент видит только адрес роута, не адрес объекта в хранилище.
 *
 * `tenant` инжектит multi-tenant плагин. Доступ на чтение/запись в админке —
 * tenantScopedCollection (персонал своего тенанта); публичный сайт ходит через
 * Local API с overrideAccess.
 */
export const Downloads: CollectionConfig = {
  slug: 'downloads',
  labels: { singular: 'Файл', plural: 'Файлы' },
  // Файл уходит в S3 (s3Storage в payload.config.ts, рядом с media/gallery).
  // Без imageSizes — это произвольный файл (книга/PDF/архив), не картинка.
  // mimeTypes не ограничиваем на уровне коллекции: список широкий; проверку
  // типа и размера делает студийный роут загрузки (downloads/upload).
  upload: true,
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'minTier', 'updatedAt'],
    group: 'Контент',
    description: 'Цифровые товары для скачивания по подписке (книги, PDF и др.).',
  },
  access: ownerScopedCollection,
  hooks: {
    beforeChange: [stampOwner],
    afterChange: [activityAfterChange('download')],
    afterDelete: [activityAfterDelete('download')],
  },
  fields: [
    // `tenant` добавляет multi-tenant плагин.
    ownerField,
    { name: 'title', type: 'text', required: true, label: 'Название' },
    {
      name: 'description',
      type: 'textarea',
      label: 'Описание',
      admin: { description: 'Короткое описание товара (обычный текст).' },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      label: 'Категория',
      admin: { description: 'Раздел витрины файлов.' },
    },
    {
      name: 'minTier',
      type: 'relationship',
      relationTo: 'subscription-tiers',
      label: 'Минимальный уровень подписки',
      admin: {
        description:
          'Пусто — файл бесплатен для всех. Иначе скачать могут подписчики этого уровня и выше.',
      },
    },
    {
      name: 'isPreview',
      type: 'checkbox',
      defaultValue: false,
      label: 'Бесплатно для всех',
      admin: {
        description: 'Открывает скачивание всем, перебивая минимальный уровень.',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Дата публикации',
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
  ],
  timestamps: true,
}
