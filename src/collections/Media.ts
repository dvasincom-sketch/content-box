import type { CollectionConfig } from 'payload'
import { publicReadTenantWrite } from '../access'

/**
 * Media (ТЗ §3.7) — tenant-scoped uploads. Logos and covers in Stage 1;
 * video/storage adapter (S3/R2) wired in Stage 2. Public read so the
 * front-end serves images unauthenticated; writes tenant-scoped. `tenant`
 * field injected by the multi-tenant plugin.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Медиафайл', plural: 'Медиафайлы' },
  upload: {
    // Файлы уходят в R2 (s3Storage в payload.config.ts). Оригинал хранится
    // как есть, на сайт отдаём размеры ниже (в разы легче). sharp генерирует
    // их при загрузке. Обложки грузятся по одной (upload-cover), поэтому
    // параллельного OOM, как было в галерее, здесь нет.
    mimeTypes: ['image/*'],
    imageSizes: [
      // landscape-обложка для обычных карточек публикаций
      {
        name: 'card',
        width: 800,
        formatOptions: { format: 'webp', options: { quality: 80 } },
      },
      // вертикальный постер 2:3 для киноряда (retina-запас на ~300px)
      {
        name: 'poster',
        width: 600,
        formatOptions: { format: 'webp', options: { quality: 80 } },
      },
      // мелкое превью (меню, связанные посты)
      {
        name: 'thumb',
        width: 400,
        formatOptions: { format: 'webp', options: { quality: 78 } },
      },
    ],
  },
  access: publicReadTenantWrite,
  fields: [
    // `tenant` added by the multi-tenant plugin.
    { name: 'alt', type: 'text', label: 'Alt-текст' },
  ],
  timestamps: true,
}
