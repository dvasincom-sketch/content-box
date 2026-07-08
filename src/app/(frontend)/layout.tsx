import React from 'react'
import './styles.css'
import { Inter, Montserrat, Manrope, Golos_Text, PT_Sans, Unbounded, Roboto } from 'next/font/google'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { SiteHeader } from '@/components/SiteHeader'

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

export const metadata = {
  description: 'White Label CMS',
  title: 'COCO JAMBO',
}

const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.classList.add('theme-'+t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.classList.add('theme-dark');}})();`

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props
  const ctx = await getTenantFromHeaders()
  const tenant = ctx?.tenant as any
  const settings = ctx?.settings as any

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
            nav={(settings?.navigation ?? []) as any[]}
          />
        )}
        <main>{children}</main>
      </body>
    </html>
  )
}
