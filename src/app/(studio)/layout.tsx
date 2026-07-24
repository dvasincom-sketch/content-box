import React from 'react'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './studio.css'
import { THEME_INIT } from '@/lib/themeInit'

// Родная пара IBM Plex: Sans — основной текст и заголовки, Mono — навигация и
// подзаголовки («печатная машинка»). Оба с кириллицей, требуют явный weight.
const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})
const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
})

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

export default function StudioRootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = `${plexSans.variable} ${plexMono.variable}`
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
