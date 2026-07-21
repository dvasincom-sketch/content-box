import type { CollectionConfig } from 'payload'
import { publicReadTenantWrite } from '../access'

/**
 * GalleryImages — изображения для галерей публикаций (задача «Галерея»).
 *
 * Отдельная upload-коллекция (не media), чтобы фото галерей не смешивались с
 * обложками/логотипами. Файлы уходят в R2 — привязка в payload.config.ts
 * (s3Storage, рядом с media).
 *
 * Организуются по папкам (folder → gallery-folders, дерево). Уровень доступа
 * НЕ на изображении: галерея наследует minTier публикации, к которой прикреплена.
 *
 * public read — фронт отдаёт превью неаутентифицированно; гейтинг полноразмера
 * (при необходимости) решается на уровне публикации/витрины.
 */
export const GalleryImages: CollectionConfig = {
  slug: 'gallery-images',
  labels: { singular: 'Изображение галереи', plural: 'Изображения галерей' },
  upload: {
    // Файлы уходят в R2 (s3Storage в payload.config.ts). Оригинал хранится
    // как есть, но на сайт НЕ отдаётся — фронт ссылается только на размеры ниже.
    // sharp (в payload.config.ts) генерирует уменьшенные версии при загрузке.
    mimeTypes: ['image/*'],
    // Два размера в WebP. Высота не задана — пропорции сохраняются.
    //  - thumbnail 600px: сетка галереи (с retina-запасом на ~300px ячейки);
    //  - large 1600px: лайтбокс.
    // Оригинал 8–10 МБ на страницы не идёт (экономия трафика ~10×).
    imageSizes: [
      {
        name: 'thumbnail',
        width: 600,
        formatOptions: { format: 'webp', options: { quality: 80 } },
      },
      {
        name: 'large',
        width: 1600,
        formatOptions: { format: 'webp', options: { quality: 82 } },
      },
    ],
  },
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['alt', 'folder', 'updatedAt'],
    group: 'Контент',
    description: 'Фото для галерей публикаций.',
  },
  access: publicReadTenantWrite,
  fields: [
    // `tenant` инжектит multi-tenant плагин.
    { name: 'alt', type: 'text', label: 'Alt / подпись по умолчанию' },
    {
      name: 'folder',
      type: 'relationship',
      relationTo: 'gallery-folders',
      label: 'Папка',
      admin: {
        description: 'Папка библиотеки для группировки. Одно изображение — одна папка.',
      },
    },
  ],
  timestamps: true,
}
