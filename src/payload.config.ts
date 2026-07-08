import { ru } from '@payloadcms/translations/languages/ru'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
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
