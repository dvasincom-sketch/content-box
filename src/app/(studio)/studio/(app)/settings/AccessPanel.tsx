'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Copy, Check, Loader2, X } from 'lucide-react'
import type { Member } from './SettingsView'

const STATUS: Record<string, { label: string; cls: string }> = {
  owner: { label: 'Владелец', cls: 'is-owner' },
  active: { label: 'Активен', cls: 'is-active' },
  pending: { label: 'Ожидает входа', cls: 'is-pending' },
  expired: { label: 'Приглашение истекло', cls: 'is-expired' },
  disabled: { label: 'Отключён', cls: 'is-expired' },
}

/**
 * Вкладка «Доступ»: список участников тенанта + приглашение по одноразовой
 * ссылке (копируется вручную) + отзыв доступа. Видна только владельцу студии.
 */
export function AccessPanel({ members }: { members: Member[] }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState<string | number | null>(null)

  async function invite() {
    setError(null); setLink(null)
    if (!email.trim()) { setError('Укажите email'); return }
    setBusy(true)
    try {
      const res = await fetch('/studio/api/access/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Не удалось пригласить'); setBusy(false); return }
      setLink(json.inviteUrl)
      setEmail(''); setName(''); setBusy(false)
      router.refresh()
    } catch {
      setError('Ошибка соединения'); setBusy(false)
    }
  }

  async function copy() {
    if (!link) return
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  async function setActive(m: Member, active: boolean) {
    const msg = active
      ? `Вернуть доступ у ${m.email}?`
      : `Отключить доступ у ${m.email}? Он не сможет войти в студию. Аккаунт и его публикации сохранятся — доступ можно вернуть.`
    if (!window.confirm(msg)) return
    setRevoking(m.id)
    try {
      const res = await fetch(active ? '/studio/api/access/restore' : '/studio/api/access/revoke', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: m.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { alert(json.error || 'Не удалось изменить доступ'); setRevoking(null); return }
      router.refresh()
    } catch {
      alert('Ошибка соединения')
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="settings__block">
      <h2>Доступ к студии</h2>
      <p className="settings__hint">
        Пригласите помощника с ограниченными правами: он сможет создавать публикации и медиа
        и редактировать только свой контент. Общие настройки (категории, подписки, оформление)
        остаются доступны только вам.
      </p>

      <div className="studio-card access__invite">
        <div className="access__invite-row">
          <label className="studio-field" style={{ flex: 2 }}>
            <span className="studio-field__label">Email участника</span>
            <input className="studio-input" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" disabled={busy} />
          </label>
          <label className="studio-field" style={{ flex: 1 }}>
            <span className="studio-field__label">Имя (необязательно)</span>
            <input className="studio-input" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
          </label>
          <button type="button" className="studio-btn studio-btn--primary access__invite-btn" onClick={invite} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />} Пригласить
          </button>
        </div>
        {error && <div className="studio-login__error">{error}</div>}
        {link && (
          <div className="access__link">
            <div className="access__link-note">
              Ссылка-приглашение готова. Скопируйте и передайте её участнику любым способом —
              по ней он задаст пароль и войдёт. Действует 7 дней.
            </div>
            <div className="access__link-row">
              <input className="studio-input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="studio-btn studio-btn--ghost" onClick={copy}>
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="access__list">
        {members.map((m) => {
          const st = STATUS[m.status] || STATUS.active
          return (
            <div key={m.id} className="studio-card access__row">
              <div className="access__row-body">
                <div className="access__row-name">{m.name || m.email}{m.isSelf && ' (вы)'}</div>
                {m.name && <div className="access__row-email">{m.email}</div>}
              </div>
              <div className="access__row-actions">
              <span className={`access__status ${st.cls}`}>{st.label}</span>
              {!m.isSelf && m.status !== 'owner' && (
                m.status === 'disabled' ? (
                  <button type="button" className="studio-btn studio-btn--ghost access__revoke"
                    onClick={() => setActive(m, true)} disabled={revoking === m.id} title="Вернуть доступ">
                    {revoking === m.id ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Включить
                  </button>
                ) : (
                  <button type="button" className="studio-btn studio-btn--ghost access__revoke"
                    onClick={() => setActive(m, false)} disabled={revoking === m.id} title="Отключить доступ">
                    {revoking === m.id ? <Loader2 size={14} className="spin" /> : <X size={14} />} Отключить
                  </button>
                )
              )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
