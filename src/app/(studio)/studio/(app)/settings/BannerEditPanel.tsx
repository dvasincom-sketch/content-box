'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Check } from 'lucide-react'

/**
 * Выдвижная панель редактирования секции «Баннер ON AIR» (banner).
 * Портал в body + .studio-portal (как остальные редакторы секций).
 * Два текстовых поля: надпись сверху (tagline) + крупный текст (onAirText).
 *
 * GET /studio/api/settings/banner/get — текущие тексты;
 * POST /studio/api/settings/banner — сохранение.
 */

export function BannerEditPanel({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tagline, setTagline] = useState('')
  const [onAirText, setOnAirText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let stop = false
    setLoading(true)
    setError(null)
    fetch('/studio/api/settings/banner/get', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (stop) return
        if (json?.error) {
          setError(json.error)
        } else if (json?.banner) {
          setTagline(json.banner.tagline ?? '')
          setOnAirText(json.banner.onAirText ?? '')
        }
      })
      .catch(() => !stop && setError('Не удалось загрузить данные'))
      .finally(() => !stop && setLoading(false))
    return () => {
      stop = true
    }
  }, [])

  async function save() {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/studio/api/settings/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tagline, onAirText }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error || 'Не удалось сохранить')
        setSaving(false)
        return
      }
      onSaved()
    } catch {
      setError('Ошибка соединения')
      setSaving(false)
    }
  }

  const panel = (
    <div className="studio-portal">
      <div className="catedit__overlay" onClick={onClose}>
        <div className="catedit" onClick={(e) => e.stopPropagation()}>
          <div className="catedit__head">
            <h3>Баннер «ON AIR»</h3>
            <button className="catmgr__icon-btn" onClick={onClose} title="Закрыть">
              <X size={18} />
            </button>
          </div>

          <div className="catedit__body">
            {loading ? (
              <div className="menubld__loading">
                <Loader2 size={18} className="spin" /> Загрузка…
              </div>
            ) : (
              <>
                <div className="studio-field">
                  <span className="studio-field__label">Надпись сверху</span>
                  <input
                    className="studio-input"
                    placeholder="Напр. BTS TV"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                  />
                  <div className="catedit__slug">
                    Мелкая надпись над крупным текстом. Пусто — значение по умолчанию.
                  </div>
                </div>

                <div className="studio-field">
                  <span className="studio-field__label">Крупный текст</span>
                  <input
                    className="studio-input"
                    placeholder="Напр. ON AIR"
                    value={onAirText}
                    onChange={(e) => setOnAirText(e.target.value)}
                  />
                  <div className="catedit__slug">
                    Крупная неоновая надпись по центру баннера. Пусто — значение по умолчанию.
                  </div>
                </div>

                {error && <div className="studio-login__error">{error}</div>}
              </>
            )}
          </div>

          <div className="catedit__foot">
            <button className="studio-btn studio-btn--ghost" onClick={onClose}>
              Отмена
            </button>
            <button
              className="studio-btn studio-btn--primary"
              onClick={save}
              disabled={saving || loading}
            >
              {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(panel, document.body)
}
