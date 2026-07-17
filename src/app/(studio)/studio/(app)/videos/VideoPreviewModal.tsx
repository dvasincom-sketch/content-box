'use client'

import React, { useState, useEffect } from 'react'
import { X, Loader2, AlertCircle } from 'lucide-react'

/**
 * Модальный плеер превью для автора. Запрашивает signed-токен с роута token,
 * затем показывает Stream-плеер (iframe с токеном вместо uid — для защищённого
 * видео). customerCode приходит с роута (из env CF_STREAM_CUSTOMER_CODE).
 */
export function VideoPreviewModal({
  videoId,
  title,
  onClose,
}: {
  videoId: number | string
  title: string
  onClose: () => void
}) {
  const [token, setToken] = useState<string | null>(null)
  const [customerCode, setCustomerCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stopped = false
    async function load() {
      try {
        const res = await fetch(`/studio/api/videos/token?id=${videoId}`, {
          credentials: 'include',
        })
        const json = await res.json()
        if (stopped) return
        if (!res.ok) {
          setError(json.error || 'Не удалось получить доступ к видео')
          return
        }
        setToken(json.token)
        setCustomerCode(json.customerCode)
      } catch {
        if (!stopped) setError('Ошибка соединения')
      }
    }
    load()
    return () => {
      stopped = true
    }
  }, [videoId])

  const iframeSrc =
    token && customerCode
      ? `https://customer-${customerCode}.cloudflarestream.com/${token}/iframe`
      : null

  return (
    <div className="vidplay__overlay" onClick={onClose}>
      <div className="vidplay" onClick={(e) => e.stopPropagation()}>
        <div className="vidplay__head">
          <span className="vidplay__title">{title}</span>
          <button className="catmgr__icon-btn" onClick={onClose} title="Закрыть">
            <X size={18} />
          </button>
        </div>

        <div className="vidplay__frame">
          {error ? (
            <div className="vidplay__msg vidplay__msg--error">
              <AlertCircle size={22} />
              <span>{error}</span>
              {!customerCode && !error.includes('токен') && (
                <span className="vidplay__hint">
                  Проверьте, что переменная CF_STREAM_CUSTOMER_CODE задана в окружении.
                </span>
              )}
            </div>
          ) : !iframeSrc ? (
            <div className="vidplay__msg">
              <Loader2 size={22} className="spin" />
              <span>Загрузка плеера…</span>
              {token && !customerCode && (
                <span className="vidplay__hint">
                  Токен получен, но нет customer code. Задайте CF_STREAM_CUSTOMER_CODE в окружении.
                </span>
              )}
            </div>
          ) : (
            <iframe
              src={iframeSrc}
              style={{ border: 'none', position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
              title={title}
            />
          )}
        </div>
      </div>
    </div>
  )
}
