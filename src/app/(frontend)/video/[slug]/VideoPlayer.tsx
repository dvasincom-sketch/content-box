'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { AudioPlayer } from '@/components/AudioPlayer'

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
  onEnded,
  autoPlay,
}: {
  videoId: string | number
  /**
   * Пропорции, известные на сервере. Нужны, чтобы вертикальный клип не
   * дёргал вёрстку: без подсказки контейнер сначала рисуется как 16:9 и
   * перестраивается после ответа /api/video-token.
   */
  initialAspect?: '16:9' | '9:16'
  /** Аудио: колбэк по окончании (для авто-перехода в плейлисте). */
  onEnded?: () => void
  /** Аудио: авто-старт при монтировании (следующая серия в плейлисте). */
  autoPlay?: boolean
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [aspect, setAspect] = useState<'16:9' | '9:16'>(initialAspect)
  const [kind, setKind] = useState<'video' | 'audio'>('video')
  const [error, setError] = useState<string | null>(null)
  // Гейт по подписке (403 от /api/video-token). Отдельно от error, чтобы
  // показать «Видео доступно с уровня «…»» и точку продажи, а не сухую ошибку.
  const [gate, setGate] = useState<{ tier: string | null; reason: string } | null>(null)

  useEffect(() => {
    let stopped = false
    // Токен иногда падает на первом запросе после простоя (перемежающийся 502/сброс
    // соединения на прокси — гонка keep-alive) и всегда проходит с повтора.
    // Тихо ретраим 5xx/сетевые осечки до 2 раз, чтобы не показывать «Ошибку
    // соединения» на бесплатном видео. 4xx (403 — гейт, 404) НЕ ретраим.
    async function fetchTokenWithRetry(attempt = 0): Promise<Response> {
      try {
        const res = await fetch(`/api/video-token?id=${videoId}`, { credentials: 'include' })
        if (res.status >= 500 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
          return fetchTokenWithRetry(attempt + 1)
        }
        return res
      } catch (e) {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
          return fetchTokenWithRetry(attempt + 1)
        }
        throw e
      }
    }
    async function load() {
      try {
        const res = await fetchTokenWithRetry()
        const json = await res.json()
        if (stopped) return
        if (!res.ok) {
          // 403 — доступ по подписке: показываем гейт с названием уровня.
          if (res.status === 403) {
            setGate({ tier: json.requiredTierName ?? null, reason: String(json.reason || '') })
          } else {
            setError(json.error || 'Не удалось загрузить видео')
          }
          return
        }
        if (json.provider === 'audio') {
          setKind('audio')
          const u = typeof json.audioUrl === 'string' && json.audioUrl.startsWith('http') ? json.audioUrl : null
          if (u) setSrc(u)
          else setError('Не удалось загрузить аудио')
        } else if (json.provider === 'embed') {
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

  // Аудио: компактный плеер-карточка (не 16:9-коробка). Гейт/ошибка/загрузка —
  // в той же карточке, на брендовых токенах (работает в обеих темах).
  if (kind === 'audio') {
    return (
      <div className="mb-8">
        <div
          className="rounded-2xl"
          style={{ background: 'var(--brand-surface)', border: '1px solid var(--brand-border)', padding: 16 }}
        >
          {gate ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', padding: '16px 8px' }}>
              <span
                className="inline-flex items-center justify-center rounded-full"
                style={{ width: 48, height: 48, background: 'color-mix(in srgb, var(--brand-primary) 14%, transparent)', color: 'var(--brand-primary)' }}
              >
                <Lock size={20} />
              </span>
              <span style={{ fontWeight: 700, color: 'var(--brand-text)' }}>
                {gate.tier ? <>Аудио доступно с уровня «{gate.tier}»</> : <>Аудио доступно по подписке</>}
              </span>
              <Link href="/subscribe" className="c-btn c-btn--primary">
                {gate.reason === 'need-login' ? 'Войти или оформить подписку' : 'Оформить подписку'}
              </Link>
            </div>
          ) : error ? (
            <div style={{ color: 'var(--brand-muted)', textAlign: 'center', padding: '16px 8px' }}>{error}</div>
          ) : !src ? (
            <div style={{ color: 'var(--brand-muted)', textAlign: 'center', padding: '16px 8px' }}>Загрузка плеера…</div>
          ) : (
            <AudioPlayer src={src} onEnded={onEnded} autoPlay={autoPlay} />
          )}
        </div>
      </div>
    )
  }

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
        {gate ? (
          // Плеер всегда на чёрном фоне, поэтому цвета фиксированные светлые —
          // читаемо и в тёмной, и в светлой теме (тема на плеер не влияет).
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <span
              className="inline-flex items-center justify-center rounded-full"
              style={{ width: 52, height: 52, background: 'rgba(255,255,255,.14)' }}
            >
              <Lock size={22} color="#fff" />
            </span>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem' }}>
              {gate.tier ? (
                <>Видео доступно с уровня «{gate.tier}»</>
              ) : (
                <>Видео доступно по подписке</>
              )}
            </span>
            <Link
              href="/subscribe"
              className="inline-block text-sm font-semibold px-5 py-2.5 rounded-xl"
              style={{ background: '#fff', color: '#111', marginTop: 4 }}
            >
              {gate.reason === 'need-login' ? 'Войти или оформить подписку' : 'Оформить подписку'}
            </Link>
          </div>
        ) : error ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6"
            style={{ color: 'rgba(255,255,255,.85)' }}
          >
            <span>{error}</span>
          </div>
        ) : !src ? (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: 'rgba(255,255,255,.7)' }}
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
