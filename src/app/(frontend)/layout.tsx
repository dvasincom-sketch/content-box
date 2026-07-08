import React from 'react'
import './styles.css'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { SiteHeader } from '@/components/SiteHeader'

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
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body
        style={{
          ...brandVars(settings?.theme),
          background: 'var(--brand-bg)',
          color: 'var(--brand-text)',
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
