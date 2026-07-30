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
 *   - embed:     готовый src внешней площадки (VK, Дзен) — уже разобранный и с
 *                проверенным хостом, см. src/lib/videoEmbed.ts. Клипы приходят
 *                с пропорциями 9:16, поэтому контейнер подстраивается.
 */
export function VideoPlayer({
  videoId,
  initialAspect = '16:9',
}: {
  videoId: string | number
  /**
   * Пропорции, известные на сервере. Нужны, чтобы вертикальный клип не
   * дёргал вёрстку: без подсказки контейнер сначала рисуется как 16:9 и
   * перестраивается после ответа /api/video-token.
   */
  initialAspect?: '16:9' | '9:16'
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [aspect, setAspect] = useState<'16:9' | '9:16'>(initialAspect)
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
        if (json.provider === 'embed') {
          if (typeof json.src === 'string' && json.src.startsWith('https://')) {
            setSrc(json.src)
            setAspect(json.aspect === '9:16' ? '9:16' : '16:9')
          } else {
            setError('Не удалось собрать плеер')
          }
        } else if (json.provider === 'kinescope') {
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

  const vertical = aspect === '9:16'

  return (
    // Два уровня намеренно. `padding-top` в процентах считается от ширины
    // РОДИТЕЛЯ, а не самого элемента, поэтому связка «paddingTop: 177.78% +
    // maxWidth: 420px» на десктопе давала бы коробку 420px в ширину и высотой
    // от ширины колонки — вертикальный клип уезжал в огромный чёрный столб.
    // Ширину ограничиваем снаружи, пропорции задаём внутри через aspect-ratio.
    <div
      className="mb-8"
      style={{
        maxWidth: vertical ? 'min(100%, 420px)' : undefined,
        marginLeft: vertical ? 'auto' : undefined,
        marginRight: vertical ? 'auto' : undefined,
      }}
    >
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          aspectRatio: vertical ? '9 / 16' : '16 / 9',
          background: '#000',
        }}
      >
        {error ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6"
            style={{ color: 'var(--brand-muted)' }}
          >
            <span>{error}</span>
          </div>
        ) : !src ? (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: 'var(--brand-muted)' }}
          >
            Загрузка плеера…
          </div>
        ) : (
          <iframe
            src={src}
            style={{
              border: 'none',
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
            }}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
            // Чужой площадке не отдаём полный адрес страницы — только origin.
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            title="Видео"
          />
        )}
      </div>
    </div>
  )
}
