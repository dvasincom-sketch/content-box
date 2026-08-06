'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Copy, Check, Loader2, Trash2 } from 'lucide-react'
import type { Member } from './SettingsView'
import { ActivityFeed } from './ActivityFeed'
import { ConfirmDialog } from './ConfirmDialog'

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
  const [reactivated, setReactivated] = useState(false)
  const [revoking, setRevoking] = useState<string | number | null>(null)
  const [confirm, setConfirm] = useState<{ message: string; onYes: () => void } | null>(null)

  async function invite() {
    setError(null); setLink(null); setReactivated(false)
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
      setReactivated(!!json.reactivated)
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

  // Тумблер доступа: вкл → restore, выкл → revoke. Без подтверждения (обратимо).
  async function toggle(m: Member, next: boolean) {
    setRevoking(m.id)
    try {
      const res = await fetch(next ? '/studio/api/access/restore' : '/studio/api/access/revoke', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: m.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Не удалось изменить доступ'); setRevoking(null); return }
      router.refresh()
    } catch {
      setError('Ошибка соединения')
    } finally {
      setRevoking(null)
    }
  }

  // Жёсткое удаление аккаунта участника: открываем студийное подтверждение.
  function del(m: Member) {
    setConfirm({
      message: `Удалить участника ${m.email} НАВСЕГДА? Аккаунт удалится без восстановления; его публикации останутся у проекта. Чтобы просто закрыть доступ — используйте тумблер.`,
      onYes: () => doDelete(m),
    })
  }
  async function doDelete(m: Member) {
    setError(null)
    setRevoking(m.id)
    try {
      const res = await fetch('/studio/api/access/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: m.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Не удалось удалить'); setRevoking(null); return }
      router.refresh()
    } catch {
      setError('Ошибка соединения')
    } finally {
      setRevoking(null)
    }
  }

  return (
    <>
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
              {reactivated
                ? 'Доступ возвращён. Новая ссылка-приглашение готова — по ней участник снова задаст пароль и войдёт. Действует 7 дней.'
                : 'Ссылка-приглашение готова. Скопируйте и передайте её участнику любым способом — по ней он задаст пароль и войдёт. Действует 7 дней.'}
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
                  <>
                    <label className="access__switch" title={m.status === 'disabled' ? 'Включить доступ' : 'Отключить доступ'}>
                      <input
                        type="checkbox"
                        checked={m.status !== 'disabled'}
                        disabled={revoking === m.id}
                        onChange={() => toggle(m, m.status === 'disabled')}
                      />
                      <span className="access__switch-track" aria-hidden="true"><span className="access__switch-thumb" /></span>
                    </label>
                    <button
                      type="button"
                      className="catmgr__icon-btn catmgr__icon-btn--danger access__del"
                      onClick={() => del(m)}
                      disabled={revoking === m.id}
                      title="Удалить навсегда"
                      aria-label="Удалить навсегда"
                    >
                      {revoking === m.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={15} />}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
    <ActivityFeed />
    {confirm && (
      <ConfirmDialog
        title="Удалить навсегда"
        message={confirm.message}
        confirmLabel="Удалить"
        busy={revoking !== null}
        onConfirm={() => { confirm.onYes(); setConfirm(null) }}
        onCancel={() => setConfirm(null)}
      />
    )}
    </>
  )
}
