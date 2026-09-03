'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Share, X } from 'lucide-react'

/**
 * Кнопка «Установить приложение».
 *  • Chrome/Android/десктоп: ловит событие beforeinstallprompt и по клику
 *    вызывает нативный промпт установки.
 *  • iOS Safari: нативного промпта нет — по клику показываем подсказку
 *    «Поделиться → На экран „Домой“».
 *  • Уже установлено (standalone) или установка недоступна → компонент ничего
 *    не рендерит (не засоряет интерфейс).
 * Стиль совпадает с иконками-кнопками хедера (.c-btn c-btn--ghost c-btn--icon).
 */
type BIPEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (window.navigator as any).standalone === true
  )
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const iOSDevice = /iphone|ipad|ipod/i.test(ua)
  // iPadOS 13+ маскируется под Mac — ловим по тач-поинтам.
  const iPadOS = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1
  return iOSDevice || iPadOS
}

export function InstallPWA({ variant = 'icon' }: { variant?: 'icon' | 'row' }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [hint, setHint] = useState(false)

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true)
      return
    }
    if (detectIOS()) setIos(true)

    const onBIP = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BIPEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
      setHint(false)
    }
    window.addEventListener('beforeinstallprompt', onBIP)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null
  if (!deferred && !ios) return null

  async function onClick() {
    if (deferred) {
      await deferred.prompt()
      try {
        await deferred.userChoice
      } catch {
        /* пользователь закрыл — ничего не делаем */
      }
      setDeferred(null)
      return
    }
    if (ios) setHint(true)
  }

  const borderSoft = 'color-mix(in srgb, var(--brand-text) 12%, transparent)'

  // Триггер: строка меню (мобайл) или иконка-кнопка (десктоп).
  const trigger = variant === 'row' ? (
    <button
      type="button"
      onClick={onClick}
      aria-label="Сохранить на рабочий стол"
      className="c-navlink py-2 px-2 rounded-lg text-base font-medium inline-flex items-center gap-2"
      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: 'var(--brand-text)' }}
    >
      <Download size={18} /> Сохранить на рабочий стол
    </button>
  ) : (
    <span className="c-tooltip-wrap">
      <button
        type="button"
        aria-label="Установить приложение"
        className="c-btn c-btn--ghost c-btn--icon c-spotlight"
        onClick={onClick}
      >
        <Download size={18} />
      </button>
      <span className="c-tooltip c-tooltip--below" role="tooltip">
        Установить приложение
      </span>
    </span>
  )

  return (
    <>
      {trigger}

      {hint && typeof document !== 'undefined' && createPortal(
        <>
          <div
            onClick={() => setHint(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.4)' }}
          />
          <div
            role="dialog"
            aria-label="Как установить приложение"
            style={{
              position: 'fixed',
              zIndex: 91,
              left: '50%',
              bottom: 24,
              transform: 'translateX(-50%)',
              width: 'min(380px, calc(100vw - 24px))',
              background: 'var(--brand-surface)',
              color: 'var(--brand-text)',
              border: `1px solid ${borderSoft}`,
              borderRadius: 20,
              padding: '18px 18px 20px',
              boxShadow: '0 16px 48px rgba(0,0,0,.32)',
            }}
          >
            <button
              type="button"
              aria-label="Закрыть"
              onClick={() => setHint(false)}
              className="c-btn c-btn--ghost c-btn--icon c-btn--sm"
              style={{ position: 'absolute', top: 12, right: 12 }}
            >
              <X size={16} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingInlineEnd: 30 }}>
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 54,
                  height: 54,
                  borderRadius: 16,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'color-mix(in srgb, var(--brand-primary) 16%, transparent)',
                  color: 'var(--brand-primary)',
                }}
              >
                <Share size={26} />
              </span>
              <div style={{ minWidth: 0 }}>
                <strong
                  style={{
                    fontFamily: 'var(--font-heading)',
                    display: 'block',
                    marginBottom: 4,
                    fontSize: 16,
                  }}
                >
                  Установить приложение
                </strong>
                <p style={{ margin: 0, lineHeight: 1.5, fontSize: 14, opacity: 0.82 }}>
                  Нажмите «Поделиться» внизу браузера, затем выберите{' '}
                  <b style={{ opacity: 1 }}>«На экран Домой»</b>.
                </p>
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
