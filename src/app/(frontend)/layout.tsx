import React from 'react'
import './styles.css'
import { Inter, Montserrat, Manrope, Golos_Text, PT_Sans, Unbounded, Roboto } from 'next/font/google'
import { getTenantFromHeaders } from '@/lib/tenant'
import { buildMenu } from '@/lib/buildMenu'
import { footerFromTree } from '@/lib/footerFromTree'
import { brandVars } from '@/lib/brand'
import { SiteHeader } from '@/components/SiteHeader'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { SiteFooter } from '@/components/SiteFooter'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { THEME_INIT } from '@/lib/themeInit'

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter', display: 'swap' })
const montserrat = Montserrat({ subsets: ['latin', 'cyrillic'], variable: '--font-montserrat', display: 'swap' })
const manrope = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-manrope', display: 'swap' })
const golos = Golos_Text({ subsets: ['latin', 'cyrillic'], variable: '--font-golos', display: 'swap' })
const ptSans = PT_Sans({ subsets: ['latin', 'cyrillic'], weight: ['400', '700'], variable: '--font-ptsans', display: 'swap' })
const unbounded = Unbounded({ subsets: ['latin', 'cyrillic'], variable: '--font-unbounded', display: 'swap' })
const roboto = Roboto({ subsets: ['latin', 'cyrillic'], variable: '--font-roboto', display: 'swap' })

const fontVars = [inter, montserrat, manrope, golos, ptSans, unbounded, roboto]
  .map((f) => f.variable)
  .join(' ')



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
    <html lang="ru" className={fontVars} suppressHydrationWarning>
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
          />
        )}
      </body>
    </html>
  )
}
