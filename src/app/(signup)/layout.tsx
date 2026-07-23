import React from 'react'
import { redirect } from 'next/navigation'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import '../(studio)/studio.css'

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

const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.classList.add('theme-'+t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.classList.add('theme-dark');}})();`

export default async function SignupLayout({ children }: { children: React.ReactNode }) {
  const author = await getCurrentAuthor()
  if (author) {
    redirect('/studio')
  }
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
