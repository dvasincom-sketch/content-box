'use client'

import React, { useState, useEffect } from 'react'

/**
 * Клиентский плеер для публичной страницы видео. Запрашивает данные с публичного
 * роута /api/video-token (который проверяет доступ по подписке и возвращает
 * провайдера). Если доступа нет — компонент не рендерится (страница показывает
 * «замок» на сервере).
 *
 * Ветвление по провайдеру:
 *   - stream:    CF-iframe с signed-токеном (customer-<code>.cloudflarestream.com)
 *   - kinescope: iframe kinescope.io/embed/<embedId>
 */
export function VideoPlayer({ videoId }: { videoId: string | number }) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stopped = false
    async function load() {
      try {
        const res = await fetch(`/api/video-token?id=${videoId}`, { credentials: 'include' })
        const json = await res.json()
        if (stopped) return
        if (!res.ok) {
          setError(json.error || 'Не удалось загрузить видео')
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

  return (
    <div
      className="relative rounded-2xl overflow-hidden mb-8"
      style={{
        paddingTop: '56.25%',
        background: '#000',
      }}
    >
      {error ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6"
          style={{ color: 'var(--brand-text)', opacity: 0.8 }}
        >
          <span>{error}</span>
        </div>
      ) : !src ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: 'var(--brand-text)', opacity: 0.6 }}
        >
          Загрузка плеера…
        </div>
      ) : (
        <iframe
          src={src}
          style={{ border: 'none', position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          title="Видео"
        />
      )}
    </div>
  )
}
