'use client'

import React, { useState } from 'react'
import { Loader2, Check } from 'lucide-react'

export type AuthorStats = {
  videosValue: string
  videosLabel: string
  membersValue: string
  membersLabel: string
}

/**
 * Счётчики витрины «Об авторе» на главной (site-settings.authorStats).
 * Свободный текст: можно «800+», «100 тыс+». Пусто в значении — подставится
 * реальное число (кол-во видео / участников). Сохранение — POST author-stats.
 */
export function AuthorStatsPanel({ initial }: { initial: AuthorStats }) {
  const [v, setV] = useState<AuthorStats>(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty =
    v.videosValue !== initial.videosValue ||
    v.videosLabel !== initial.videosLabel ||
    v.membersValue !== initial.membersValue ||
    v.membersLabel !== initial.membersLabel

  function set(k: keyof AuthorStats, val: string) {
    setV((s) => ({ ...s, [k]: val }))
    setSaved(false)
  }

  async function save() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/studio/api/settings/author-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(v),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Не удалось сохранить')
      } else {
        setSaved(true)
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2>Счётчики «Об авторе»</h2>
        <p>Числа в блоке «Об авторе» на главной. Можно писать текстом — «800+», «100 тыс+». Пусто в значении — покажется реальное число.</p>
      </div>

      <div className="astats__grid">
        <div className="studio-field">
          <span className="studio-field__label">Первый счётчик — значение</span>
          <input className="studio-input" placeholder="Напр. 800+" value={v.videosValue} onChange={(e) => set('videosValue', e.target.value)} />
        </div>
        <div className="studio-field">
          <span className="studio-field__label">Первый счётчик — подпись</span>
          <input className="studio-input" placeholder="озвученных видео" value={v.videosLabel} onChange={(e) => set('videosLabel', e.target.value)} />
        </div>
        <div className="studio-field">
          <span className="studio-field__label">Второй счётчик — значение</span>
          <input className="studio-input" placeholder="Напр. 100 тыс+" value={v.membersValue} onChange={(e) => set('membersValue', e.target.value)} />
        </div>
        <div className="studio-field">
          <span className="studio-field__label">Второй счётчик — подпись</span>
          <input className="studio-input" placeholder="участников" value={v.membersLabel} onChange={(e) => set('membersLabel', e.target.value)} />
        </div>
      </div>

      {error && <div className="settings__err">{error}</div>}

      <div className="astats__foot">
        <button type="button" className="studio-btn studio-btn--primary" onClick={save} disabled={saving || !dirty}>
          {saving ? <><Loader2 size={15} className="spin" /> Сохранение…</> : saved && !dirty ? <><Check size={15} /> Сохранено</> : 'Сохранить'}
        </button>
      </div>
    </section>
  )
}
