import { ru } from '@payloadcms/translations/languages/ru'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { s3Storage } from '@payloadcms/storage-s3'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { isSuperAdmin } from './access'
import { meiliSearchPlugin } from './search/plugin'
import { rusenderEmailAdapter } from './emails/rusenderAdapter'
import { Tenants } from './collections/Tenants'
import { Users } from './collections/Users'
import { SiteSettings } from './collections/SiteSettings'
import { Categories } from './collections/Categories'
import { Publications } from './collections/Publications'
import { Pages } from './collections/Pages'
import { MenuItems } from './collections/MenuItems'
import { Media } from './collections/Media'
import { SubscriptionTiers } from './collections/SubscriptionTiers'
import { Subscribers } from './collections/Subscribers'
import { Videos } from './collections/Videos'
import { VideoFolders } from './collections/VideoFolders'
import { GalleryImages } from './collections/GalleryImages'
import { GalleryFolders } from './collections/GalleryFolders'
import { Downloads } from './collections/Downloads'
import { Books } from './collections/Books'
import { Chapters } from './collections/Chapters'
import { BookFollows } from './collections/BookFollows'
import { Comments } from './collections/Comments'
import { Reactions } from './collections/Reactions'
import { ActivityEvents } from './collections/ActivityEvents'
import { Submissions } from './collections/Submissions'
import { BugReports } from './collections/BugReports'
import { Bookmarks } from './collections/Bookmarks'
import { Follows } from './collections/Follows'
import { ViewHistory } from './collections/ViewHistory'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Ограничиваем нативную память sharp: на Render (512 МБ) генерация превью
// (imageSizes обложек/галерей) иначе даёт всплеск RSS и OOM-убийство процесса
// — а это возвращает клиенту НЕ-JSON (падение рантайма), из-за чего загрузка
// «молча» падала. cache(false) — не держим декодированные буферы в кэше;
// concurrency(1) — не крутим несколько тяжёлых операций sharp параллельно.
sharp.cache(false)
sharp.concurrency(1)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      graphics: {
        Logo: '@/components/admin/BrandLogo',
        Icon: '@/components/admin/BrandIcon',
      },
      // Брендовый блок над формой входа.
      beforeLogin: ['@/components/admin/BeforeLogin'],
      // Ссылки на кастомные view — ПОСЛЕ коллекций (внизу меню).
      afterNavLinks: ['@/components/SeoAuditNavLink', '@/components/StatsNavLink', '@/components/admin/HelpNavLink'],
      // Кастомные root-view.
      views: {
        // SEO-аудит: сводная таблица проблем по категориям (/admin/seo-audit).
        seoAudit: {
          Component: '@/views/SeoAuditView',
          path: '/seo-audit',
          meta: {
            title: 'SEO-аудит',
            description: 'Сводка проблем SEO по категориям',
          },
        },
        // Статистика: заглушка под будущую аналитику (/admin/stats).
        stats: {
          Component: '@/views/StatsView',
          path: '/stats',
          meta: {
            title: 'Статистика',
            description: 'Аналитика по подпискам',
          },
        },
        help: {
          Component: '@/views/HelpView',
          path: '/help',
          meta: {
            title: 'Помощь',
            description: 'Руководство по наполнению сайта',
          },
        },
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
  collections: [
    Tenants,
    Users,
    SiteSettings,
    Categories,
    Publications,
    Pages,
    MenuItems,
    Media,
    SubscriptionTiers,
    Subscribers,
    Videos,
    VideoFolders,
    GalleryImages,
    GalleryFolders,
    Downloads,
    Books,
    Chapters,
    BookFollows,
    Comments,
    Reactions,
    ActivityEvents,
    Submissions,
    BugReports,
    Bookmarks,
    Follows,
    ViewHistory,
  ],
  editor: lexicalEditor(),
  // Почта через RuSender API (Bearer-токен + ID ключа). Подключается ТОЛЬКО при
  // заданном RUSENDER_API_TOKEN — без него поведение прежнее (письма не шлём).
  email: process.env.RUSENDER_API_TOKEN ? rusenderEmailAdapter() : undefined,
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // Живучесть процесса при разрывах соединения с БД (см. комментарий у db.pool).
  //
  // 1) pool.on('error') — ошибку простаивающего клиента pg (управляемая БД
  //    закрыла соединение) только логируем; пул сам заменит соединение. Без
  //    этого слушателя EventEmitter кидает ошибку в процесс.
  // 2) process.on('unhandledRejection') — одиночный ECONNRESET при установке
  //    соединения всплывает как необработанное отклонение, а Node по умолчанию
  //    ГАСИТ процесс. Тогда инфраслой отдаёт 503 всем, а не только сбойному
  //    запросу. Здесь — логируем и продолжаем работать.
  onInit: async (payload) => {
    const pool = (
      payload.db as unknown as { pool?: { on?: (e: 'error', cb: (err: unknown) => void) => void } }
    ).pool
    if (pool && typeof pool.on === 'function') {
      pool.on('error', (err) => {
        payload.logger.warn(
          { err },
          '[db] ошибка простаивающего клиента пула Postgres — соединение будет пересоздано',
        )
      })
    }
    const g = globalThis as unknown as { __cbUnhandledGuard?: boolean }
    if (!g.__cbUnhandledGuard) {
      g.__cbUnhandledGuard = true
      process.on('unhandledRejection', (reason) => {
        payload.logger.error({ reason }, '[process] unhandledRejection проглочено — процесс продолжает работу')
      })
    }
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
      // Стабильность соединения под управляемым Postgres (Timeweb).
      // Симптом был: переход в раздел из меню иногда падал — RSC-запрос
      // отдавал 503 (в браузере «network error»), показывался экран «Не
      // удалось загрузить раздел», а прямой заход тем же URL работал. В логах:
      // «cannot connect to Postgres. Details: read ECONNRESET». Управляемая БД
      // молча рвёт простаивающее TCP-соединение, а пул pg потом отдаёт
      // «мёртвое» соединение. keepAlive держит соединение живым (TCP-пробы),
      // maxUses периодически пересоздаёт клиентов, короткие таймауты не дают
      // залипнуть на дохлом соединении.
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      max: 20,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      maxUses: 7_500,
    },
    push: false,
  }),
  sharp,
  plugins: [
    // Дерево категорий (ТЗ §3.4). Плагин добавляет `parent` и `breadcrumbs`,
    // рекурсивно обновляет потомков при смене родителя.
    nestedDocsPlugin({
      collections: ['categories', 'video-folders', 'gallery-folders'],
      generateLabel: (_, doc) => doc.title as string,
      // Полный путь: /category/discography/chapter-1/school-trilogy
      generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ''),
    }),

    // Медиа в Cloudflare R2 (ТЗ §3.7, §9). Локальный диск Render не переживает деплой.
    s3Storage({
      collections: {
        media: {
          // Файлы отдаются напрямую с публичного домена хранилища, минуя
          // приложение. Для публичных картинок access control не нужен.
          disablePayloadAccessControl: true,
          generateFileURL: ({ filename }) =>
            `${process.env.S3_PUBLIC_URL || process.env.R2_PUBLIC_URL}/${filename}`,
        },
        'gallery-images': {
          // Фото галерей — та же схема отдачи, что и media.
          disablePayloadAccessControl: true,
          generateFileURL: ({ filename }) =>
            `${process.env.S3_PUBLIC_URL || process.env.R2_PUBLIC_URL}/${filename}`,
        },
        downloads: {
          // Файлы («Файлы») лежат в том же бакете. Прямой публичный URL на сайт
          // НЕ отдаётся — скачивание идёт через защищённый роут
          // `/api/download/[id]` (гейтинг по подписке). Здесь URL нужен, чтобы
          // роут смог прочитать объект из хранилища на стороне сервера.
          disablePayloadAccessControl: true,
          generateFileURL: ({ filename }) =>
            `${process.env.S3_PUBLIC_URL || process.env.R2_PUBLIC_URL}/${filename}`,
        },
      },
      // Объектное хранилище S3. Переезд с Cloudflare R2 на Timeweb Cloud S3:
      // endpoint https://s3.twcstorage.ru, регион ru-1, адреса path-style
      // (https://s3.twcstorage.ru/<бакет>/<файл>) — отсюда forcePathStyle.
      // Старые R2_* оставлены фолбэком, чтобы прод не упал в момент перехода;
      // основными в compose/.env идут S3_*.
      bucket: process.env.S3_BUCKET || process.env.R2_BUCKET || '',
      config: {
        endpoint: process.env.S3_ENDPOINT || process.env.R2_ENDPOINT || '',
        region: process.env.S3_REGION || 'ru-1',
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey:
            process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '',
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
        'menu-items': { useTenantAccess: false },
        media: { useTenantAccess: false },
        'subscription-tiers': { useTenantAccess: false },
        subscribers: { useTenantAccess: false },
        videos: { useTenantAccess: false },
        'video-folders': { useTenantAccess: false },
        'gallery-images': { useTenantAccess: false },
        'gallery-folders': { useTenantAccess: false },
        downloads: { useTenantAccess: false },
        books: { useTenantAccess: false },
        chapters: { useTenantAccess: false },
        'book-follows': { useTenantAccess: false },
        comments: { useTenantAccess: false },
        reactions: { useTenantAccess: false },
        'activity-events': { useTenantAccess: false },
        submissions: { useTenantAccess: false },
        'bug-reports': { useTenantAccess: false },
        bookmarks: { useTenantAccess: false },
        follows: { useTenantAccess: false },
        views: { useTenantAccess: false },
      } as any,
    }),

    // Поиск на Meilisearch: вешает хуки синхронизации на publications/categories/
    // videos/pages и создаёт индекс на старте (onInit). Последним — чтобы видеть
    // коллекции после инъекции `tenant` мульти-тенант плагином.
    meiliSearchPlugin(),
  ],
})
