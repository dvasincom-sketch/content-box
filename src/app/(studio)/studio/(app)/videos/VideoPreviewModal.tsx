'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, AlertCircle } from 'lucide-react'

/**
 * Модальный плеер превью для автора. Запрашивает данные с роута token, который
 * возвращает провайдера. Ветвление:
 *   - stream:    CF-iframe с signed-токеном
 *   - kinescope: iframe kinescope.io/embed/<embedId>
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
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Портал в body работает только на клиенте — монтируемся после гидрации.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

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
        if (json.provider === 'kinescope') {
          setSrc(json.embedId ? `https://kinescope.io/embed/${json.embedId}` : null)
        } else if (json.token && json.customerCode) {
          setSrc(`https://customer-${json.customerCode}.cloudflarestream.com/${json.token}/iframe`)
        } else {
          setError('Не удалось собрать плеер')
        }
      } catch {
        if (!stopped) setError('Ошибка соединения')
      }
    }
    load()
    return () => {
      stopped = true
    }
  }, [videoId])

  if (!mounted) return null

  return createPortal(
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
            </div>
          ) : !src ? (
            <div className="vidplay__msg">
              <Loader2 size={22} className="spin" />
              <span>Загрузка плеера…</span>
            </div>
          ) : (
            <iframe
              src={src}
              style={{ border: 'none', position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
              title={title}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
