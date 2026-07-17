'use client'

import React, { useState, useEffect } from 'react'

/**
 * Клиентский плеер для публичной страницы видео. Запрашивает signed-токен с
 * публичного роута /api/video-token (который сам проверяет доступ по подписке).
 * Если доступ есть — показывает Stream-плеер. Если нет — этот компонент вообще
 * не рендерится (страница показывает «замок» на серверной стороне).
 *
 * Стилизация — через inline-стили и Tailwind, в тон публичного сайта (brand-vars).
 */
export function VideoPlayer({ videoId }: { videoId: string | number }) {
  const [token, setToken] = useState<string | null>(null)
  const [customerCode, setCustomerCode] = useState<string | null>(null)
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
      ) : !iframeSrc ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: 'var(--brand-text)', opacity: 0.6 }}
        >
          Загрузка плеера…
        </div>
      ) : (
        <iframe
          src={iframeSrc}
          style={{ border: 'none', position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          title="Видео"
        />
      )}
    </div>
  )
}
