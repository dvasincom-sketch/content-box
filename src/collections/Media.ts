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
  upload: true, // файлы уходят в R2 (s3Storage в payload.config.ts)
  access: publicReadTenantWrite,
  fields: [
    // `tenant` added by the multi-tenant plugin.
    { name: 'alt', type: 'text', label: 'Alt-текст' },
  ],
  timestamps: true,
}
