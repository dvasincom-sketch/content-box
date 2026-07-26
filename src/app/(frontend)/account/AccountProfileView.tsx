'use client'

import React, { useRef, useState } from 'react'
import { ImagePlus, Loader2, Check } from 'lucide-react'

/**
 * Форма настроек профиля участника: аватар, публичное имя, адрес /u/<handle>,
 * «о себе», тумблер приватности. (Уровень/значки/публикации — на витрине профиля.)
 */
export function SettingsForm({
  displayName: initialName,
  avatarUrl: initialAvatar,
  bio: initialBio,
  handle: initialHandle,
  suggestedHandle,
  profilePrivate: initialPrivate,
}: {
  displayName: string
  avatarUrl: string | null
  bio: string
  handle: string
  suggestedHandle: string
  profilePrivate: boolean
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatar)
  const [displayName, setDisplayName] = useState(initialName)
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
    if (!displayName.trim()) { setError('Укажите публичное имя'); return }
    setSaving(true)
    try {
      const res = await fetch('/account/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName, bio, handle, profilePrivate: isPrivate }),
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
  const field = { display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: 'var(--brand-text)' } as React.CSSProperties

  return (
    <>
      <h1 style={{ fontSize: 26, color: 'var(--brand-text)', marginBottom: 20 }}>Настройки</h1>

      <div className="c-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span className="acct__ava" style={{ width: 72, height: 72, fontSize: 26 }}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Аватар" />
            ) : (
              initial
            )}
          </span>
          <div>
            <button className="c-btn c-btn--surface" type="button" onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              {avatarUrl ? 'Заменить аватар' : 'Загрузить аватар'}
            </button>
            <input ref={fileInput} type="file" accept="image/*" onChange={onAvatar} style={{ display: 'none' }} />
          </div>
        </div>

        <label style={{ display: 'block' }}>
          <span style={field}>Публичное имя</span>
          <input className="c-input" value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} placeholder="Как вас видят другие" style={{ width: '100%' }} />
        </label>

        <label style={{ display: 'block' }}>
          <span style={field}>Адрес профиля</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--brand-muted)' }}>/u/</span>
            <input className="c-input" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} placeholder="ваш-адрес" style={{ flex: 1 }} />
          </div>
        </label>

        <label style={{ display: 'block' }}>
          <span style={field}>О себе <span style={{ color: 'var(--brand-muted)', fontWeight: 400 }}>({bio.length}/280)</span></span>
          <textarea className="c-input" value={bio} maxLength={280} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Пара слов о себе" style={{ width: '100%', resize: 'vertical' }} />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
          <span style={{ color: 'var(--brand-text)' }}>Скрыть профиль (не виден другим и не индексируется)</span>
        </label>

        {error && <div style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          {saved && (
            <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
              <Check size={15} /> Сохранено
            </span>
          )}
          <button className="c-btn c-btn--primary" type="button" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : null} Сохранить
          </button>
        </div>
      </div>
    </>
  )
}
