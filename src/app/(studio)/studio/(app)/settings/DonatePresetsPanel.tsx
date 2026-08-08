'use client'

import React, { useState } from 'react'
import { Loader2, Check, Plus, Trash2 } from 'lucide-react'

export type DonatePreset = { amount: number; label: string }

const DEFAULTS: DonatePreset[] = [
  { amount: 300, label: 'кофе автору' },
  { amount: 500, label: 'лайк рублём' },
  { amount: 1000, label: 'час озвучки' },
  { amount: 2000, label: 'щедро' },
  { amount: 5000, label: 'меценат' },
]

/**
 * Быстрые суммы блока «Поддержать разово» (site-settings.donatePresets).
 * Чипсы: сумма + подпись. Пусто — на сайте покажутся значения по умолчанию.
 */
export function DonatePresetsPanel({ initial }: { initial: DonatePreset[] }) {
  const [rows, setRows] = useState<DonatePreset[]>(initial.length ? initial : DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(i: number, patch: Partial<DonatePreset>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
    setSaved(false)
  }
  function add() {
    setRows((r) => [...r, { amount: 0, label: '' }])
    setSaved(false)
  }
  function remove(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i))
    setSaved(false)
  }

  async function save() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const presets = rows
        .map((r) => ({ amount: Math.max(0, Math.floor(Number(r.amount) || 0)), label: String(r.label || '').trim() }))
        .filter((r) => r.amount > 0)
      const res = await fetch('/studio/api/settings/donate-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ presets }),
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
        <h2>Поддержать разово</h2>
        <p>Быстрые суммы-чипсы на странице поддержки. Подпись — короткая («кофе автору»). Оставьте пустым — покажутся суммы по умолчанию.</p>
      </div>

      <div className="dpreset__list">
        {rows.map((row, i) => (
          <div key={i} className="dpreset__row">
            <input
              className="studio-input dpreset__amount"
              type="number"
              min={0}
              placeholder="500"
              value={row.amount || ''}
              onChange={(e) => set(i, { amount: Number(e.target.value) })}
            />
            <span className="dpreset__cur">₽</span>
            <input
              className="studio-input dpreset__label"
              placeholder="подпись (напр. лайк рублём)"
              maxLength={24}
              value={row.label}
              onChange={(e) => set(i, { label: e.target.value })}
            />
            <button type="button" className="studio-btn studio-btn--ghost dpreset__del" onClick={() => remove(i)} title="Удалить">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="studio-btn studio-btn--ghost dpreset__add" onClick={add}>
        <Plus size={14} /> Добавить сумму
      </button>

      {error && <div className="settings__err">{error}</div>}

      <div className="astats__foot">
        <button type="button" className="studio-btn studio-btn--primary" onClick={save} disabled={saving}>
          {saving ? <><Loader2 size={15} className="spin" /> Сохранение…</> : saved ? <><Check size={15} /> Сохранено</> : 'Сохранить'}
        </button>
      </div>
    </section>
  )
}
