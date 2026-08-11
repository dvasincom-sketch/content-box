'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Loader2, ShieldCheck, Check } from 'lucide-react'
import { StudioSelect } from '../_ui/StudioSelect'

/**
 * Передача прав владельца проекта другому участнику. Двухшаговый безопасный
 * сценарий: выбор участника → код подтверждения на почту владельца → ввод кода.
 * После подтверждения владельцем становится выбранный участник, а текущий —
 * администратором (полный доступ сохраняется).
 */
type Target = { id: string; label: string }

export function OwnerTransferPanel({ targets }: { targets: Target[] }) {
  const router = useRouter()
  const [targetId, setTargetId] = useState('')
  const [step, setStep] = useState<'idle' | 'code'>('idle')
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function request() {
    if (!targetId) { setError('Выберите участника'); return }
    setBusy(true); setError(null)
    try {
      const r = await fetch('/studio/api/access/transfer-owner', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'request', targetUserId: targetId }),
      })
      const j = await r.json()
      if (!r.ok) setError(j.error || 'Не удалось')
      else { setSentTo(j.sentTo || ''); setStep('code') }
    } catch { setError('Ошибка соединения') } finally { setBusy(false) }
  }

  async function confirm() {
    if (!/^\d{6}$/.test(code.trim())) { setError('Код — 6 цифр'); return }
    setBusy(true); setError(null)
    try {
      const r = await fetch('/studio/api/access/transfer-owner', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'confirm', code: code.trim() }),
      })
      const j = await r.json()
      if (!r.ok) setError(j.error || 'Не удалось')
      else { setDone(true); setTimeout(() => router.refresh(), 1200) }
    } catch { setError('Ошибка соединения') } finally { setBusy(false) }
  }

  function cancel() { setStep('idle'); setCode(''); setError(null); setSentTo('') }

  if (targets.length === 0) return null

  return (
    <div className="settings__block">
      <h2>Передача прав владельца</h2>
      <p className="settings__hint">
        Можно передать проект другому участнику. Для безопасности мы отправим код подтверждения на вашу почту.
        После передачи владельцем станет выбранный участник, а вы — администратором (полный доступ сохранится).
      </p>
      <div className="studio-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
        {done ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--st-success, #22c55e)', fontWeight: 600 }}>
            <Check size={18} /> Права переданы. Обновляем…
          </div>
        ) : step === 'idle' ? (
          <>
            <label className="studio-field">
              <span className="studio-field__label">Новый владелец</span>
              <StudioSelect value={targetId} onChange={setTargetId} disabled={busy} ariaLabel="Новый владелец" placeholder="Выберите участника" options={targets.map((t) => ({ value: t.id, label: t.label }))} />
            </label>
            <div>
              <button type="button" className="studio-btn studio-btn--primary" onClick={request} disabled={busy || !targetId}>
                {busy ? <Loader2 size={16} className="spin" /> : <Crown size={16} />} Отправить код на почту
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: 'var(--st-text-muted)' }}>
              Код отправлен на <b style={{ color: 'var(--st-text)' }}>{sentTo}</b>. Введите его, чтобы подтвердить передачу.
            </div>
            <label className="studio-field" style={{ maxWidth: 220 }}>
              <span className="studio-field__label">Код из письма</span>
              <input className="studio-input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="000000" style={{ letterSpacing: 4, fontVariantNumeric: 'tabular-nums' }} disabled={busy} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="studio-btn studio-btn--primary" onClick={confirm} disabled={busy || code.length < 6}>
                {busy ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />} Подтвердить передачу
              </button>
              <button type="button" className="studio-btn studio-btn--ghost" onClick={cancel} disabled={busy}>Отмена</button>
            </div>
          </>
        )}
        {error && <div className="studio-login__error">{error}</div>}
      </div>
    </div>
  )
}
