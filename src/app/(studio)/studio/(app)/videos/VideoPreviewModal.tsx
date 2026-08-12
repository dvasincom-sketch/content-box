'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, AlertCircle } from 'lucide-react'
import { SelfHostedPlayer } from '@/app/(frontend)/video/[slug]/SelfHostedPlayer'

/**
 * Модальный плеер превью для автора. Запрашивает данные с роута token, который
 * возвращает провайдера. Ветвление:
 *   - self:      собственный HLS → SelfHostedPlayer (кастомные контролы)
 *   - embed:     внешняя вставка (VK/Дзен) → iframe по сохранённому src
 *   - kinescope: iframe kinescope.io/embed/<embedId>
 *   - stream:    CF-iframe с signed-токеном
 */
type SelfData = {
  master: string
  poster?: string | null
  sprite?: string | null
  subtitles?: { lang: string; label: string; url: string }[]
  chapters?: { start: number; title: string }[]
}
type Player = { kind: 'iframe'; src: string } | { kind: 'self'; data: SelfData }

export function VideoPreviewModal({
  videoId,
  title,
  onClose,
}: {
  videoId: number | string
  title: string
  onClose: () => void
}) {
  const [player, setPlayer] = useState<Player | null>(null)
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
        if (json.provider === 'self') {
          if (json.status !== 'ready' || !json.master) {
            setError(json.status === 'error' ? 'Обработка видео завершилась ошибкой' : 'Видео ещё обрабатывается — превью будет доступно после кодирования')
            return
          }
          setPlayer({ kind: 'self', data: { master: json.master, poster: json.poster, sprite: json.sprite, subtitles: json.subtitles, chapters: json.chapters } })
        } else if (json.provider === 'embed') {
          if (!json.src) { setError('У видео нет корректной ссылки'); return }
          setPlayer({ kind: 'iframe', src: String(json.src) })
        } else if (json.provider === 'kinescope') {
          if (!json.embedId) { setError('Не удалось собрать плеер'); return }
          setPlayer({ kind: 'iframe', src: `https://kinescope.io/embed/${json.embedId}` })
        } else if (json.token && json.customerCode) {
          setPlayer({ kind: 'iframe', src: `https://customer-${json.customerCode}.cloudflarestream.com/${json.token}/iframe` })
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
    <div className="studio-portal">
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
            ) : !player ? (
              <div className="vidplay__msg">
                <Loader2 size={22} className="spin" />
                <span>Загрузка плеера…</span>
              </div>
            ) : player.kind === 'self' ? (
              <SelfHostedPlayer
                master={player.data.master}
                poster={player.data.poster}
                sprite={player.data.sprite}
                subtitles={player.data.subtitles}
                chapters={player.data.chapters}
              />
            ) : (
              <iframe
                src={player.src}
                style={{ border: 'none', position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
                title={title}
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
