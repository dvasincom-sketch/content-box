import React from 'react'
import { redirect } from 'next/navigation'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import '../(studio)/studio.css'
// Локальные шрифты IBM Plex (@fontsource) вместо next/font/google — без обращения
// к Google Fonts на билде. Переменные --font-sans / --font-mono — из studio/fonts.css.
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import '../(studio)/fonts.css'
import { THEME_INIT } from '@/lib/themeInit'

// Регистрация зависит от auth/БД (getCurrentAuthor) — не пререндерим на билде,
// иначе `next build` виснет на запросе к недоступной БД.
export const dynamic = 'force-dynamic'

/**
 * Оболочка страницы регистрации (/signup).
 *
 * Отдельная route-группа, повторяющая шелл СТУДИИ: те же шрифты IBM Plex,
 * те же токены `--st-*` (импорт studio.css) и та же инициализация темы, что и на
 * /studio/login. Так регистрация визуально совпадает с входом и студией.
 * Тема наследуется с лендинга (общий localStorage-ключ `theme`).
 *
 * Guard: уже залогиненного автора уводим в /studio (как (studio)/(auth)).
 */
export default async function SignupLayout({ children }: { children: React.ReactNode }) {
  const author = await getCurrentAuthor()
  if (author) {
    redirect('/studio')
  }
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body style={{ margin: 0 }}>
        <div className="studio-root">{children}</div>
      </body>
    </html>
  )
}
