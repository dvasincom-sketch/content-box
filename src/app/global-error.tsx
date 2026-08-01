'use client'

// Глобальный обработчик ошибок — САМЫЙ верхний рубеж.
//
// (frontend)/error.tsx ловит ошибки СТРАНИЦ внутри своего layout, но НЕ ловит
// ошибку в самом корневом layout. А корневой layout ходит в БД (buildMenu,
// текущий подписчик, страницы меню): разрыв соединения с Postgres там всплывал
// бы мимо error.tsx — и без глобального обработчика Next показывал бы голый
// белый экран. Этот файл заменяет собой корневой layout при фатальной ошибке,
// поэтому обязан рендерить собственные <html>/<body>.
//
// Логика та же, что в RouteError: осечку чанка/сети лечим одним тихим reload
// (свежий HTML + свежее соединение с БД), иначе — брендовый экран с кнопкой.

import { useEffect, useState } from 'react'

const RELOAD_KEY = 'cb-chunk-reload-at'
const RELOAD_COOLDOWN_MS = 10_000

function isRecoverable(e: unknown): boolean {
  const obj = e as { name?: unknown; message?: unknown } | null
  const name = obj && typeof obj.name === 'string' ? obj.name : ''
  const message = obj && typeof obj.message === 'string' ? obj.message : ''
  return (
    /ChunkLoadError|NetworkError/i.test(name) ||
    /Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported|network error|Failed to fetch|Load failed|Connection closed|net::ERR/i.test(
      message,
    )
  )
}

export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const recoverable = isRecoverable(error)
  const [reloading, setReloading] = useState(recoverable)

  useEffect(() => {
    if (!recoverable) return
    const now = Date.now()
    let last = 0
    try {
      last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0
    } catch {
      /* приватный режим */
    }
    if (now - last < RELOAD_COOLDOWN_MS) {
      setReloading(false)
      return
    }
    try {
      sessionStorage.setItem(RELOAD_KEY, String(now))
    } catch {
      /* ignore */
    }
    window.location.reload()
  }, [recoverable])

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          background: '#0F0A1E',
          color: '#F5F3FF',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        {reloading ? (
          <div>Обновляем страницу…</div>
        ) : (
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: '1.4rem', margin: '0 0 8px' }}>Не удалось загрузить страницу</h1>
            <p style={{ opacity: 0.75, margin: '0 0 20px', lineHeight: 1.5 }}>
              Обычно помогает обновление страницы.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 10,
                  padding: '10px 20px',
                  fontWeight: 600,
                  color: '#fff',
                  background: '#7C3AED',
                }}
              >
                Обновить страницу
              </button>
              <button
                type="button"
                onClick={() => window.location.assign('/')}
                style={{
                  cursor: 'pointer',
                  borderRadius: 10,
                  padding: '10px 18px',
                  fontWeight: 600,
                  background: 'transparent',
                  color: '#F5F3FF',
                  border: '1px solid rgba(124,58,237,.4)',
                }}
              >
                На главную
              </button>
            </div>
          </div>
        )}
      </body>
    </html>
  )
}
