'use client'

import { useEffect, useState } from 'react'

/**
 * Экран ошибки маршрута с авто-восстановлением после деплоя.
 *
 * Главная задача — гасить ChunkLoadError: у пользователя открыта старая вкладка,
 * вышла новая сборка, хеши JS/CSS-чанков сменились, и переход по меню тянет
 * исчезнувший чанк → Next рисует встроенный «This page couldn't load». Здесь:
 *  - если это ошибка загрузки чанка/динамического импорта — ОДИН раз тихо
 *    перезагружаем страницу (свежий HTML + манифест), пользователь просто
 *    попадает в нужный раздел;
 *  - иначе показываем аккуратный брендовый экран с кнопкой «Обновить».
 *
 * Защита от циклов — по времени: если авто-перезагрузка была меньше 10 секунд
 * назад (значит и свежая сборка падает), больше не перезагружаем, а показываем
 * ручной экран. Для следующего деплоя (минуты/часы спустя) авто-режим снова
 * доступен — без флага, который надо где-то сбрасывать.
 */
const RELOAD_KEY = 'cb-chunk-reload-at'
const RELOAD_COOLDOWN_MS = 10_000

function isChunkLoadError(e: unknown): boolean {
  const obj = e as { name?: unknown; message?: unknown } | null
  const name = obj && typeof obj.name === 'string' ? obj.name : ''
  const message = obj && typeof obj.message === 'string' ? obj.message : ''
  return (
    /ChunkLoadError/i.test(name) ||
    /Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported/i.test(
      message,
    )
  )
}

export function RouteError({ error }: { error: Error & { digest?: string } }) {
  const chunk = isChunkLoadError(error)
  const [reloading, setReloading] = useState(chunk)

  useEffect(() => {
    if (!chunk) return
    const now = Date.now()
    let last = 0
    try {
      last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0
    } catch {
      /* приватный режим — ок, перезагрузимся без памяти */
    }
    // Недавно уже перезагружали, а всё равно упало — не зацикливаемся.
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
  }, [chunk])

  const wrap: React.CSSProperties = {
    minHeight: '70vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    textAlign: 'center',
    color: 'var(--brand-text, #F5F3FF)',
    fontFamily: 'var(--font-body, system-ui, sans-serif)',
  }

  if (reloading) {
    return <div style={wrap}>Обновляем страницу…</div>
  }

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 420 }}>
        <h1
          style={{
            fontFamily: 'var(--font-heading, var(--font-body, system-ui, sans-serif))',
            fontSize: '1.4rem',
            margin: '0 0 8px',
          }}
        >
          Не удалось загрузить раздел
        </h1>
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
              background: 'var(--brand-primary, #7C3AED)',
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
              color: 'var(--brand-text, #F5F3FF)',
              border: '1px solid var(--brand-border, rgba(124,58,237,.3))',
            }}
          >
            На главную
          </button>
        </div>
      </div>
    </div>
  )
}
