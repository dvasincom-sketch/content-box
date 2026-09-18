'use client'

import { useEffect, useState, useCallback } from 'react'

/**
 * Регистрирует /sw.js и даёт кнопку «Обновить» для установленного PWA.
 *
 * Зачем кнопка. Установленное приложение (PWA) живёт одной длинной сессией и
 * крутит тот бандл, который загрузился при запуске. Новые правки на сайте
 * (например, «картинка в картинке») не появляются, пока приложение не сделает
 * полную перезагрузку. Обычная навигация внутри PWA этого не делает, а сам
 * sw.js при контент-деплое не меняется — значит браузер не покажет «новая
 * версия». Поэтому нужен видимый механизм.
 *
 * Что делает кнопка. Чистит ВСЕ кэши (в т.ч. кэш service worker), просит SW
 * обновиться и делает жёсткую перезагрузку — приложение подтягивает свежий
 * бандл и все актуальные данные вместо того, что лежало в кэше.
 *
 * Автоподсветка. Клиент знает свой build id (запечён в бандл на сборке). Раз в
 * минуту и при возвращении в приложение он спрашивает у сервера текущий build id
 * (/api/version). Если сервер отвечает другим — значит вышло обновление, и
 * кнопка становится акцентной с подписью «Доступно обновление». Если эндпойнта
 * ещё нет (первый деплой этой правки) — тихо игнорируем, кнопка остаётся
 * обычной ручной «Обновить».
 *
 * Кнопка показывается ТОЛЬКО в установленном приложении (standalone): в обычном
 * браузере есть своя перезагрузка, там она не нужна.
 */

const MY_BUILD = process.env.NEXT_PUBLIC_BUILD_ID || 'dev'

export function PWARegister() {
  const [standalone, setStandalone] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [busy, setBusy] = useState(false)

  // Регистрация service worker (как было) — только прод и при поддержке.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad)
    return () => window.removeEventListener('load', onLoad)
  }, [])

  // Только установленное приложение (PWA). iOS отдаёт navigator.standalone.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const check = () => {
      const mm = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
      const ios = (navigator as unknown as { standalone?: boolean }).standalone === true
      setStandalone(Boolean(mm || ios))
    }
    check()
    const mq = window.matchMedia ? window.matchMedia('(display-mode: standalone)') : null
    mq?.addEventListener?.('change', check)
    return () => mq?.removeEventListener?.('change', check)
  }, [])

  // Опрос версии: сравниваем свой (запечённый) build id с серверным.
  useEffect(() => {
    if (!standalone) return
    let alive = true
    const check = async () => {
      try {
        const r = await fetch('/api/version', { cache: 'no-store' })
        if (!r.ok) return
        const d = (await r.json()) as { v?: string }
        if (alive && d?.v && d.v !== MY_BUILD) setUpdateAvailable(true)
      } catch {
        /* эндпойнта может ещё не быть — молчим */
      }
    }
    check()
    const id = window.setInterval(check, 60_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [standalone])

  const doRefresh = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(
          regs.map(async (r) => {
            try {
              await r.update()
            } catch {}
            try {
              r.waiting?.postMessage({ type: 'SKIP_WAITING' })
            } catch {}
          }),
        )
      }
    } catch {}
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {}
    // Жёсткая перезагрузка: тянем свежий документ и бандл вместо кэша.
    window.location.reload()
  }, [busy])

  if (!standalone) return null

  const accent = updateAvailable
  return (
    <button
      type="button"
      onClick={doRefresh}
      disabled={busy}
      aria-label={accent ? 'Доступно обновление — обновить приложение' : 'Обновить приложение'}
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        zIndex: 9999,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        maxWidth: 'calc(100vw - 24px)',
        padding: accent ? '10px 16px' : '9px 14px',
        borderRadius: 999,
        border: accent
          ? '1px solid transparent'
          : '1px solid color-mix(in srgb, var(--brand-text, #111) 14%, transparent)',
        background: accent
          ? 'var(--brand-primary, #ea580c)'
          : 'color-mix(in srgb, var(--brand-bg, #fff) 80%, transparent)',
        color: accent ? '#fff' : 'var(--brand-text, #111)',
        font: '600 13.5px/1 var(--font-body, system-ui, -apple-system, Segoe UI, Roboto, sans-serif)',
        letterSpacing: '-0.01em',
        cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.7 : accent ? 1 : 0.9,
        boxShadow: accent
          ? '0 10px 30px -10px color-mix(in srgb, var(--brand-primary, #ea580c) 60%, transparent)'
          : '0 8px 24px -14px rgba(0,0,0,.5)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
        backdropFilter: 'blur(12px) saturate(1.2)',
        transition: 'opacity .15s ease, background .15s ease, padding .15s ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={busy ? { animation: 'cb-upd-spin .8s linear infinite' } : undefined}
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {busy ? 'Обновляем…' : accent ? 'Доступно обновление' : 'Обновить'}
      </span>
      {accent && !busy && (
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 0 0 0 rgba(255,255,255,.7)',
            animation: 'cb-upd-pulse 1.6s ease-out infinite',
          }}
        />
      )}
      <style>{`
        @keyframes cb-upd-spin { to { transform: rotate(360deg) } }
        @keyframes cb-upd-pulse {
          0% { box-shadow: 0 0 0 0 rgba(255,255,255,.7) }
          70% { box-shadow: 0 0 0 8px rgba(255,255,255,0) }
          100% { box-shadow: 0 0 0 0 rgba(255,255,255,0) }
        }
      `}</style>
    </button>
  )
}
