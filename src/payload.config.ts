import { ru } from '@payloadcms/translations/languages/ru'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { isSuperAdmin } from './access'
import { Tenants } from './collections/Tenants'
import { Users } from './collections/Users'
import { SiteSettings } from './collections/SiteSettings'
import { Categories } from './collections/Categories'
import { Publications } from './collections/Publications'
import { Pages } from './collections/Pages'
import { Media } from './collections/Media'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      graphics: {
        Logo: '@/components/admin/EmptyLogo',
        Icon: '@/components/admin/EmptyIcon',
      },
    },
    // Виджеты панели: разная раскладка для суперадмина и editor'а.
    dashboard: {
      widgets: [
        {
          slug: 'counters',
          Component: '@/components/admin/CountersWidget',
          label: 'Сводка',
        },
        {
          slug: 'quickActions',
          Component: '@/components/admin/QuickActionsWidget',
          label: 'Быстрые действия',
        },
        {
          slug: 'recentPublications',
          Component: '@/components/admin/RecentPublicationsWidget',
          label: 'Последние публикации',
        },
      ],
      // Раскладка зависит от роли: суперадмин видит платформу, editor — свой контент.
      defaultLayout: ({ req }) => {
        const superAdmin = (req.user as any)?.platformRole === 'superadmin'
        if (superAdmin) {
          return [
            { widgetSlug: 'counters', width: 'medium' },
            { widgetSlug: 'quickActions', width: 'medium' },
            { widgetSlug: 'collections', width: 'full' },
          ] as any
        }
        return [
          { widgetSlug: 'quickActions', width: 'medium' },
          { widgetSlug: 'counters', width: 'medium' },
          { widgetSlug: 'recentPublications', width: 'full' },
          { widgetSlug: 'collections', width: 'full' },
        ] as any
      },
    },
  },
  // Order matters for admin nav; Tenants first (platform), then content.
  i18n: {
    supportedLanguages: { ru },
    fallbackLanguage: 'ru',
  },
  collections: [Tenants, Users, SiteSettings, Categories, Publications, Pages, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    push: false,
  }),
  sharp,
  plugins: [
    // Медиа в Cloudflare R2 (ТЗ §3.7, §9). Локальный диск Render не переживает деплой.
    s3Storage({
      collections: {
        media: {
          // Файлы отдаются напрямую с публичного R2-домена (CDN Cloudflare),
          // минуя Render. Для публичных картинок access control не нужен.
          disablePayloadAccessControl: true,
          generateFileURL: ({ filename }) => `${process.env.R2_PUBLIC_URL}/${filename}`,
        },
      },
      bucket: process.env.R2_BUCKET || '',
      config: {
        endpoint: process.env.R2_ENDPOINT || '',
        region: 'auto', // для R2 всегда 'auto', не location бакета
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
      },
    }),
    multiTenantPlugin({
      tenantsSlug: 'tenants',
      // Cross-tenant super admin (ТЗ §2). Bypasses tenant scoping platform-wide.
      userHasAccessToAllTenants: (user) => isSuperAdmin(user as any),
      // Collections carrying a `tenant` field. The plugin injects the field,
      // the admin tenant selector, and cleanup-on-delete. We set
      // useTenantAccess:false because the ТЗ uses a single-tenant user model
      // (`user.tenant`) and our own access functions enforce the scoping.
      collections: {
        'site-settings': { useTenantAccess: false },
        categories: { useTenantAccess: false },
        publications: { useTenantAccess: false },
        pages: { useTenantAccess: false },
        media: { useTenantAccess: false },
      },
    }),
  ],
})
