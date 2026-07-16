import React from 'react'
import { Inter, Manrope } from 'next/font/google'
import './studio.css'

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter', display: 'swap' })
const manrope = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-manrope', display: 'swap' })

/**
 * Корневой layout route-группы (studio).
 *
 * ОТДЕЛЬНЫЙ от (frontend)/layout.tsx: своё <html>, свои токены студии, белый
 * акцент вместо брендового тенанта. Здесь НЕТ guard'а — проверка автора живёт
 * в двух вложенных под-layout'ах:
 *   - studio/(app)/layout.tsx  — приватная часть, требует автора;
 *   - studio/(auth)/layout.tsx — вход, уводит уже авторизованного на дашборд.
 * Так login и приватные экраны получают разные оболочки без middleware —
 * существующий proxy.ts проекта не затрагивается.
 */

const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.classList.add('theme-'+t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.classList.add('theme-dark');}})();`

export default function StudioRootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = `${inter.variable} ${manrope.variable}`
  return (
    <html lang="ru" className={fontVars} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body style={{ margin: 0 }}>
        <div className="studio-root">{children}</div>
      </body>
    </html>
  )
}
