import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

// Хост публичного домена хранилища для next/image (Timeweb S3: s3.twcstorage.ru).
// R2_PUBLIC_URL остаётся фолбэком на время перехода с Cloudflare R2.
const mediaPublicUrl = process.env.S3_PUBLIC_URL || process.env.R2_PUBLIC_URL
const mediaHost = mediaPublicUrl ? new URL(mediaPublicUrl).hostname : undefined

const nextConfig: NextConfig = {
  // fast-geoip читает свои .dat из node_modules в рантайме — не бандлим его,
  // иначе рушится путь к данным. База едет в образ (полный node_modules).
  serverExternalPackages: ['fast-geoip'],
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
    remotePatterns: mediaHost
      ? [
          {
            protocol: 'https',
            hostname: mediaHost,
            pathname: '/**',
          },
        ]
      : [],
  },
  /**
   * Security-заголовки. До этого не отдавался ни один.
   *
   * Про CSP отдельно: полноценную политику здесь ставить нельзя без подготовки —
   * в `<head>` есть инлайн-скрипт темы (THEME_INIT, он и убирает FOUC), админка
   * Payload тянет свои инлайн-стили, а плеер грузится в iframe Kinescope. Любой
   * `script-src` без nonce сломает или тему, или /admin. Поэтому включаем только
   * те директивы, которые к скриптам не относятся и ничего не ломают, а полную
   * политику стоит сначала обкатать в Report-Only (заготовка ниже).
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Только HTTPS.
          //
          // Без includeSubDomains — сознательно. Заголовок уходит на ответы
          // ЛЮБОГО хоста, включая собственные домены авторов. Если автор
          // подключил apex (example.com), includeSubDomains запинал бы браузеры
          // посетителей на HTTPS для mail.example.com, old.example.com и прочих
          // поддоменов, которыми платформа не управляет и которые могут ещё
          // отдаваться по http. Каждый поддомен получает свой HSTS со своих же
          // ответов, так что теряем мы немного.
          //
          // preload тоже не ставим: это необратимо.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          // Запрет MIME-sniffing: загруженный «png» не будет исполнен как скрипт.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Реферер за пределы сайта — только origin, без пути (в путях у нас
          // бывают токены: verify-email, reset-password, unsubscribe).
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Кликджекинг: наши страницы нельзя вставить в чужой фрейм. Своё в
          // своём остаётся возможным — на случай live preview в админке.
          // (Встраивание плеера Kinescope это не затрагивает: директива про то,
          // кто фреймит НАС, а не кого фреймим мы.)
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          // Директивы, не затрагивающие скрипты и стили: запрет вставки сайта
          // в чужой фрейм, плагинов, подмены base href и отправки форм наружу.
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ]
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
