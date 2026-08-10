import React from 'react'
import './studio.css'
// Локальные шрифты IBM Plex (@fontsource) вместо next/font/google — без обращения
// к Google Fonts на билде. Переменные --font-sans / --font-mono — в fonts.css.
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './fonts.css'
import { THEME_INIT } from '@/lib/themeInit'
import { UmamiTracker } from '@/components/UmamiTracker'
import { UMAMI_STUDIO_WEBSITE_ID } from '@/lib/umami'
import { PWARegister } from '@/components/PWARegister'

// Студия — авторизованное приложение (auth + БД), не статика. Рендерим на каждый
// запрос, иначе `next build` пытается пререндерить и упирается в недоступную на
// билде БД (таймаут). Покрывает всю подветку (auth + app).
export const dynamic = 'force-dynamic'

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
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {/* Продуктовая аналитика студии (Umami, отдельный website «студия»).
            No-op, пока не задан UMAMI_STUDIO_WEBSITE_ID и UMAMI_SCRIPT_URL. */}
        <UmamiTracker websiteId={UMAMI_STUDIO_WEBSITE_ID} />
      </head>
      <body style={{ margin: 0 }}>
        {/* Регистрируем service worker и в студии: во время деплоя апстрим лежит,
            и SW показывает «обновляемся» вместо белого экрана. */}
        <PWARegister />
        <div className="studio-root">{children}</div>
      </body>
    </html>
  )
}
