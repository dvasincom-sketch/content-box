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
import './fonts.css'
import { getTenantFromHeaders } from '@/lib/tenant'
import { buildMenu } from '@/lib/buildMenu'
import { footerFromTree } from '@/lib/footerFromTree'
import { brandVars } from '@/lib/brand'
import { SiteHeader } from '@/components/SiteHeader'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { SiteFooter } from '@/components/SiteFooter'
import { SpotlightController } from '@/components/SpotlightController'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { THEME_INIT } from '@/lib/themeInit'

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
  let navItems: { label: string; url: string }[] = []

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
  }

  const logo = settings?.logo
  const logoUrl = logo && typeof logo === 'object' ? logo.url : null
  const logoAlt = logo && typeof logo === 'object' ? logo.alt : null

  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body
        style={{
          ...brandVars(settings?.theme, settings?.typography),
          background: 'var(--brand-bg)',
          color: 'var(--brand-text)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-size)',
          fontWeight: 'var(--text-weight)' as any,
          margin: 0,
          minHeight: '100vh',
        }}
      >
        <SpotlightController />
        {ctx && (
          <SiteHeader
            logoUrl={logoUrl}
            logoAlt={logoAlt}
            brandName={tenant?.name ?? 'COCO JAMBO'}
            nav={navItems}
            menu={menu}
            subscriber={subscriber}
          />
        )}
        <main>{children}</main>
        {ctx && (
          <SiteFooter
            brandName={tenant?.name ?? ''}
            copyright={`© ${new Date().getFullYear()} ${tenant?.name ?? ''}. Все права защищены.`}
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
      </body>
    </html>
  )
}
