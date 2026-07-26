'use client'

import React, { useRef, useState } from 'react'
import Link from 'next/link'
import { ImagePlus, Loader2, Check } from 'lucide-react'
import { levelName, nextLevel } from '@/lib/reputation'
import type { Badge } from '@/lib/badges'

/**
 * Редактор профиля участника (Фаза 1). Аватар, «о себе», адрес /u/<handle>,
 * тумблер приватности. Сохранение — POST /account/api/*. Конверсия: бесплатному
 * показываем превью эксклюзивного значка «по подписке».
 */
export function AccountProfileView({
  displayName,
  avatarUrl: initialAvatar,
  bio: initialBio,
  handle: initialHandle,
  suggestedHandle,
  profilePrivate: initialPrivate,
  hasPaidTier,
  level,
  points,
  badges,
}: {
  displayName: string
  avatarUrl: string | null
  bio: string
  handle: string
  suggestedHandle: string
  profilePrivate: boolean
  hasPaidTier: boolean
  level: number
  points: number
  badges: Badge[]
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatar)
  const [bio, setBio] = useState(initialBio)
  const [handle, setHandle] = useState(initialHandle || suggestedHandle)
  const [isPrivate, setIsPrivate] = useState(initialPrivate)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/account/api/avatar', { method: 'POST', body: fd, credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) setError(json.error || 'Не удалось загрузить')
      else setAvatarUrl(json.url)
    } catch {
      setError('Ошибка загрузки')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function save() {
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      const res = await fetch('/account/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bio, handle, profilePrivate: isPrivate }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) setError(json.error || 'Не удалось сохранить')
      else {
        setSaved(true)
        if (json.handle) setHandle(json.handle)
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setSaving(false)
    }
  }

  const initial = (displayName.trim()[0] || '?').toUpperCase()

  return (
    <>
      <h1 style={{ fontSize: 28, color: 'var(--brand-text)', marginBottom: 6 }}>Мой профиль</h1>
      <p style={{ color: 'var(--brand-muted)', marginBottom: 24 }}>
        Как вас видят другие участники. Профиль публичный — если не скрыть его ниже.
      </p>
      <div style={{ marginBottom: 20, color: 'var(--brand-text)' }}>
        Уровень: <b>{levelName(level)}</b> · {points} очков
        {nextLevel(points) ? (
          <span style={{ color: 'var(--brand-muted)' }}>
            {'  '}· до «{nextLevel(points)!.name}» — {Math.max(0, nextLevel(points)!.min - points)} очков
          </span>
        ) : null}
      </div>
      {badges.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {badges.map((b) => (
            <span
              key={b.id}
              title={b.desc}
              style={{
                fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
                color: b.exclusive ? 'var(--brand-accent)' : 'var(--brand-text)',
                background: b.exclusive
                  ? 'color-mix(in srgb, var(--brand-accent) 14%, transparent)'
                  : 'color-mix(in srgb, var(--brand-text) 8%, transparent)',
              }}
            >
              {b.name}
            </span>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <Link href="/account/submit" className="c-btn c-btn--primary">Написать публикацию</Link>
      </div>
      <div className="c-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* Аватар */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            aria-hidden
            style={{
              width: 72, height: 72, borderRadius: 999, flex: 'none',
              display: 'grid', placeItems: 'center', overflow: 'hidden',
              background: 'color-mix(in srgb, var(--brand-primary) 16%, transparent)',
              color: 'var(--brand-text)', fontSize: 26, fontWeight: 700,
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Аватар" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              initial
            )}
          </div>
          <div>
            <button className="c-btn c-btn--surface" type="button" onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              {avatarUrl ? 'Заменить аватар' : 'Загрузить аватар'}
            </button>
            <input ref={fileInput} type="file" accept="image/*" onChange={onAvatar} style={{ display: 'none' }} />
          </div>
        </div>

        {/* Адрес профиля */}
        <label style={{ display: 'block' }}>
          <span style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: 'var(--brand-text)' }}>
            Адрес профиля
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--brand-muted)' }}>/u/</span>
            <input
              className="c-input"
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
              placeholder="ваш-адрес"
              style={{ flex: 1 }}
            />
          </div>
        </label>

        {/* О себе */}
        <label style={{ display: 'block' }}>
          <span style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: 'var(--brand-text)' }}>
            О себе <span style={{ color: 'var(--brand-muted)', fontWeight: 400 }}>({bio.length}/280)</span>
          </span>
          <textarea
            className="c-input"
            value={bio}
            maxLength={280}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Пара слов о себе"
            style={{ width: '100%', resize: 'vertical' }}
          />
        </label>

        {/* Приватность */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
          <span style={{ color: 'var(--brand-text)' }}>Скрыть профиль (не виден другим и не индексируется)</span>
        </label>

        {error && <div style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14 }}>
            {handle && !isPrivate ? (
              <Link href={`/u/${handle}`} className="c-link" style={{ color: 'var(--brand-primary)' }}>
                Открыть мой профиль → /u/{handle}
              </Link>
            ) : (
              <span style={{ color: 'var(--brand-muted)' }}>Профиль скрыт</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {saved && (
              <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
                <Check size={15} /> Сохранено
              </span>
            )}
            <button className="c-btn c-btn--primary" type="button" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              Сохранить
            </button>
          </div>
        </div>
      </div>

      {/* Конверсия: превью статуса «по подписке» для бесплатных */}
      {!hasPaidTier && (
        <div
          className="c-card"
          style={{ padding: 20, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
        >
          <span style={{ color: 'var(--brand-muted)' }}>
            Эксклюзивный значок и приоритет в сообществе — <span style={{ color: 'var(--brand-text)' }}>по подписке</span>.
          </span>
          <Link href="/subscribe" className="c-btn c-btn--primary">Оформить подписку</Link>
        </div>
      )}
    </>
  )
}
