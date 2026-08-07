'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronDown, Loader2, Trash2 } from 'lucide-react'

export type Goal = {
  id: number | string
  title: string
  description: string
  targetRub: number
  raisedRub: number
  weight: number
  isActive: boolean
  slug: string
}

const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(n || 0)

/**
 * Управление целями сбора (support-goals) на вкладке «Подписки».
 * Список + сворачиваемый редактор на каждую цель + создание. Влияет на
 * страницу «Поддержать проект».
 */
export function GoalsPanel({ initial }: { initial: Goal[] }) {
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState<number | string | null>(null)

  return (
    <section className="settings__block">
      <div className="settings__block-head settings__block-head--row">
        <div>
          <h2>Цели сбора</h2>
          <p>Показываются на странице «Поддержать проект». «Собрано» пока задаётся вручную; позже будет считаться из платежей.</p>
        </div>
        <button className="studio-btn studio-btn--ghost settings__add-tier" onClick={() => { setCreating((v) => !v); setOpenId(null) }}>
          <Plus size={16} /> Новая цель
        </button>
      </div>

      {creating && (
        <GoalEditor mode="create" onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />
      )}

      {initial.length === 0 && !creating ? (
        <p className="settings__hint">Целей пока нет. Создайте первую — например, «На новый микрофон».</p>
      ) : (
        <div className="settings__tiers-list">
          {initial.map((g) => {
            const pct = g.targetRub > 0 ? Math.min(100, Math.round((g.raisedRub / g.targetRub) * 100)) : 0
            return (
              <div key={g.id} className="settings__tier-row">
                <button className="settings__tier-summary" onClick={() => setOpenId(openId === g.id ? null : g.id)}>
                  <ChevronDown size={16} className={openId === g.id ? 'settings__tier-chev is-open' : 'settings__tier-chev'} />
                  <span className="settings__tier-name-txt">{g.title}</span>
                  <span className="settings__tier-price-txt">{fmt(g.raisedRub)} / {fmt(g.targetRub)} ₽</span>
                  <span className="settings__tier-weight">{pct}%</span>
                  {!g.isActive && <span className="settings__tier-off">выкл</span>}
                </button>
                {openId === g.id && <GoalEditor mode="edit" goal={g} onDone={() => setOpenId(null)} onCancel={() => setOpenId(null)} />}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function GoalEditor({ mode, goal, onDone, onCancel }: { mode: 'create' | 'edit'; goal?: Goal; onDone: () => void; onCancel: () => void }) {
  const router = useRouter()
  const [title, setTitle] = useState(goal?.title || '')
  const [description, setDescription] = useState(goal?.description || '')
  const [targetRub, setTargetRub] = useState(String(goal?.targetRub ?? ''))
  const [raisedRub, setRaisedRub] = useState(String(goal?.raisedRub ?? '0'))
  const [weight, setWeight] = useState(String(goal?.weight ?? '0'))
  const [isActive, setIsActive] = useState(goal?.isActive ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    if (!title.trim()) return setError('Укажите название цели')
    if (targetRub === '' || Number.isNaN(Number(targetRub))) return setError('Укажите цель (число)')
    setBusy(true)
    try {
      const url = mode === 'create' ? '/studio/api/settings/goal-create' : '/studio/api/settings/goal'
      const body: any = {
        title: title.trim(),
        description,
        targetRub: Number(targetRub),
        raisedRub: raisedRub === '' ? 0 : Number(raisedRub),
        weight: weight === '' ? 0 : Number(weight),
        isActive,
      }
      if (mode === 'edit') body.id = goal!.id
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Не удалось сохранить'); setBusy(false); return }
      onDone()
      router.refresh()
    } catch { setError('Ошибка соединения'); setBusy(false) }
  }

  async function remove() {
    if (!goal) return
    if (!window.confirm(`Удалить цель «${goal.title}»?`)) return
    setBusy(true)
    try {
      const res = await fetch('/studio/api/settings/goal-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ id: goal.id }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Не удалось удалить'); setBusy(false); return }
      onDone()
      router.refresh()
    } catch { setError('Ошибка соединения'); setBusy(false) }
  }

  return (
    <div className="tier-editor">
      <div className="tier-editor__grid">
        <label className="studio-field" style={{ gridColumn: '1 / -1' }}>
          <span className="studio-field__label">Название цели</span>
          <input className="studio-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="На новый микрофон" />
        </label>
        <label className="studio-field" style={{ gridColumn: '1 / -1' }}>
          <span className="studio-field__label">Описание</span>
          <textarea className="studio-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Коротко, на что собираем." />
        </label>
        <label className="studio-field">
          <span className="studio-field__label">Цель, ₽</span>
          <input className="studio-input" type="number" value={targetRub} onChange={(e) => setTargetRub(e.target.value)} placeholder="120000" />
        </label>
        <label className="studio-field">
          <span className="studio-field__label">Собрано, ₽</span>
          <input className="studio-input" type="number" value={raisedRub} onChange={(e) => setRaisedRub(e.target.value)} placeholder="0" />
        </label>
        <label className="studio-field">
          <span className="studio-field__label">Порядок</span>
          <input className="studio-input" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" />
        </label>
        <label className="studio-field studio-field--check">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>Активна</span>
        </label>
      </div>

      {error && <div className="settings__err">{error}</div>}

      <div className="tier-editor__actions">
        <button className="studio-btn studio-btn--primary" onClick={save} disabled={busy}>
          {busy ? <><Loader2 size={15} className="spin" /> Сохранение…</> : 'Сохранить'}
        </button>
        <button className="studio-btn studio-btn--ghost" onClick={onCancel} disabled={busy}>Отмена</button>
        {mode === 'edit' && (
          <button className="studio-btn studio-btn--ghost tier-editor__delete" onClick={remove} disabled={busy} style={{ marginLeft: 'auto' }}>
            <Trash2 size={15} /> Удалить
          </button>
        )}
      </div>
    </div>
  )
}
