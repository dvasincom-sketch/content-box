import React from 'react'
import './styles.css'
// Локальные шрифты (@fontsource) вместо next/font/google: ставятся как
// npm-зависимости, поэтому `next build` НЕ ходит за ними в Google Fonts
// (это убирает зависание сборки на РФ-сети). Переменные --font-* — в fonts.css.
import '@fontsource-variable/inter'
import '@fontsource-variable/montserrat'
import '@fontsource-variable/manrope'
import '@fontsource-variable/golos-text'
import '@fontsource/pt-sans/400.css'
import '@fontsource/pt-sans/700.css'
import '@fontsource-variable/unbounded'
import '@fontsource-variable/roboto'
import '@fontsource/ibm-plex-mono/500.css'
import './fonts.css'
// PT Serif — вендорный серифный шрифт (для пресета velvet-resonance), @font-face вручную.
import './pt-serif.css'
import { getTenantFromHeaders } from '@/lib/tenant'
import { buildMenu } from '@/lib/buildMenu'
import { footerFromTree } from '@/lib/footerFromTree'
import { brandVars } from '@/lib/brand'
import { SiteHeader } from '@/components/SiteHeader'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { avatarColor } from '@/lib/publicationEngagement'
import { SiteFooter } from '@/components/SiteFooter'
import { SpotlightController } from '@/components/SpotlightController'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { THEME_INIT } from '@/lib/themeInit'
import { BRAND_CACHE } from '@/lib/brandCache'
import { presetThemeCss, getPreset } from '@/lib/themePresets'
import { getBgDecor } from '@/lib/bgDecors'
import { PWARegister } from '@/components/PWARegister'
import { BugReportWidget } from '@/components/BugReportWidget'
import { AskAsya } from '@/components/AskAsya'
import { asyaEnabled } from '@/lib/asya'
import { UmamiTracker } from '@/components/UmamiTracker'
import BrokenImageFallback from '@/components/BrokenImageFallback'

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props
  const ctx = await getTenantFromHeaders()
  const tenant = ctx?.tenant as any
  const settings = ctx?.settings as any
  const subscriber = await getCurrentSubscriber()

  // Меню шапки и футер строятся из единого конструктора (menu-items):
  // buildMenu сливает автоген категорий с ручными оверрайдами.
  const menu = tenant ? await buildMenu(tenant.id as number, 'header') : []
  const footerTree = tenant ? await buildMenu(tenant.id as number, 'footer') : []
  const { nav: footerNav, columns: footerColumns } = footerFromTree(footerTree)
  const navItems: { label: string; url: string }[] = []
  let subscriberAvatarUrl: string | null = null

  if (tenant?.id) {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const pagesRes = await payload.find({
      collection: 'pages',
      where: {
        and: [
          { tenant: { equals: tenant.id } },
          { showInMenu: { equals: true } },
        ],
      },
      sort: 'menuOrder',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })

    // Страницы с showInMenu — ссылки в шапке (рядом с деревом категорий).
    for (const page of pagesRes.docs as any[]) {
      navItems.push({ label: page.title, url: `/page/${page.slug}` })
    }

    // Аватар подписчика для шапки: payload.auth отдаёт avatar как id (без URL),
    // поэтому подтягиваем медиа отдельно.
    const av = (subscriber as any)?.avatar
    if (av) {
      if (typeof av === 'object' && av.url) {
        subscriberAvatarUrl = av.url
      } else {
        const media = await payload
          .findByID({ collection: 'media', id: av, depth: 0, overrideAccess: true })
          .catch(() => null)
        subscriberAvatarUrl = (media as any)?.url ?? null
      }
    }
  }

  const logo = settings?.logo
  const logoUrl = logo && typeof logo === 'object' ? logo.url : null
  const logoAlt = logo && typeof logo === 'object' ? logo.alt : null
  const preset = getPreset(settings?.themePreset)
  // Фоновый декор: выбор автора (bgDecor) приоритетнее дефолта пресета (preset.decor).
  const decorSlug = (settings as { bgDecor?: string } | null)?.bgDecor
  const decor = getBgDecor(decorSlug && decorSlug !== 'none' ? decorSlug : preset.decor)
  const themeColor = preset.light.bg
  const legalName = tenant?.name ?? ''
  const year = new Date().getFullYear()
  const copyrightText = legalName
    ? '© 2021–' +
      year +
      ' ' +
      legalName +
      '. Все права защищены. ' +
      legalName +
      ' — это коммерческое название компании. Все услуги предоставляются «как есть», и ' +
      legalName +
      ' не имеет никаких лицензий, так как деятельность не лицензируется.'
    : '© 2021–' + year + '. Все права защищены.'

  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {/* Цвета выбранного пресета: обе версии (.theme-dark/.theme-light),
            scoped by class. Тумблер темы флипает класс — применяется мгновенно. */}
        <style dangerouslySetInnerHTML={{ __html: presetThemeCss(settings?.themePreset) }} />
        {/* Кэш бренд-цветов для экрана переподключения из service worker */}
        <script dangerouslySetInnerHTML={{ __html: BRAND_CACHE }} />
        {/* PWA: динамический манифест на тенанта, иконки и мета для установки */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content={themeColor} />
        <link rel="icon" type="image/png" href="/pwa-icon?size=192" />
        <link rel="apple-touch-icon" href="/pwa-icon?size=180" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={tenant?.name ?? 'Content Box'} />
        {/* Веб-аналитика Umami: подключается только если задан UMAMI_SCRIPT_URL и
            у тенанта заполнен umamiWebsiteId. Иначе ничего не рендерит. */}
        <UmamiTracker websiteId={tenant?.umamiWebsiteId} />
      </head>
      <body
        className={`preset-${preset.id}`}
        style={{
          ...brandVars(settings),
          background: 'var(--brand-bg)',
          color: 'var(--brand-text)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-size)',
          fontWeight: 'var(--text-weight)' as any,
          margin: 0,
          minHeight: '100vh',
        }}
      >
        {decor && (
          <div
            className={`bg-decor bg-decor--${decor.kind}`}
            style={{ '--decor-img': `url(/theme/decor/${decor.slug}.svg)` } as React.CSSProperties}
            aria-hidden
          >
            <span className="bg-decor__a" />
            <span className="bg-decor__b" />
          </div>
        )}
        <BrokenImageFallback />
        <SpotlightController />
        <PWARegister />
        {ctx && (
          <SiteHeader
            logoUrl={logoUrl}
            logoAlt={logoAlt}
            brandName={tenant?.name ?? ''}
            nav={navItems}
            menu={menu}
            subscriber={
              subscriber
                ? {
                    email: subscriber.email,
                    displayName: subscriber.displayName,
                    avatarUrl: subscriberAvatarUrl,
                    color: avatarColor((subscriber as any).id),
                    // Активная подписка → окантовка аватара (флейр подписчика).
                    isSubscriber: Boolean(
                      (subscriber as any).activeTier &&
                        (subscriber as any).subscriptionUntil &&
                        new Date((subscriber as any).subscriptionUntil).getTime() > Date.now(),
                    ),
                  }
                : null
            }
          />
        )}
        <main>{children}</main>
        {ctx && (
          <SiteFooter
            brandName={tenant?.name ?? ''}
            copyright={copyrightText}
            nav={footerNav}
            columns={footerColumns}
            support={[]}
            legal={[
              { label: 'Публичная оферта', href: '/page/offer' },
              { label: 'Политика конфиденциальности', href: '/page/privacy' },
              { label: 'Пользовательское соглашение', href: '/page/terms' },
            ]}
            paymentCards={['Visa', 'Mastercard', 'МИР']}
            complianceNote={'Сайт соблюдает требования 54-ФЗ «О применении ККТ» и 152-ФЗ «О персональных данных». Приём платежей по банковским картам, чек об оплате направляется на e-mail.'}
          />
        )}
        {/* Баг-баунти: плашка «Нашёл баг» только на реальном тенанте. */}
        {ctx && <BugReportWidget authed={!!subscriber} source="site" loginHref="/account" />}
        {/* Ассистент «Спросить Асю» — перк подписки; гейт и ответ решает сервер. */}
        {ctx && asyaEnabled() && <AskAsya subscribeHref="/subscribe" loginHref="/login" />}
      </body>
    </html>
  )
}
