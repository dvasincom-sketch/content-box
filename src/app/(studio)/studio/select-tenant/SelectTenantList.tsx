'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, LogOut, Trash2, AlertTriangle } from 'lucide-react'

type TenantRow = { id: number; name: string; subdomain: string }

const COUNT_LABEL: Record<string, string> = {
  publications: 'публикаций',
  videos: 'видео/аудио',
  books: 'книг',
  downloads: 'файлов',
  subscribers: 'подписчиков',
}

/**
 * Клиентский список проектов для superadmin: выбор активного тенанта и удаление
 * тестовых проектов (только superadmin). Удаление защищено: непустой проект
 * требует повторного подтверждения (force). Стили — токены студии.
 */
export function SelectTenantList({
  tenants,
  currentId,
  email,
}: {
  tenants: TenantRow[]
  currentId: number | null
  email: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const [confirm, setConfirm] = useState<TenantRow | null>(null)
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [delBusy, setDelBusy] = useState(false)
  const [delErr, setDelErr] = useState<string | null>(null)

  async function pick(id: number) {
    setError(null)
    setBusy(id)
    try {
      const res = await fetch('/studio/api/select-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenantId: id }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(j.error || 'Не удалось выбрать проект')
        setBusy(null)
        return
      }
      router.replace('/studio')
      router.refresh()
    } catch {
      setError('Ошибка соединения')
      setBusy(null)
    }
  }

  async function runDelete(force: boolean) {
    if (!confirm) return
    setDelErr(null)
    setDelBusy(true)
    try {
      const res = await fetch('/studio/api/delete-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenantId: confirm.id, force }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.status === 409 && j.error === 'not-empty') {
        setCounts(j.counts || {})
        setDelBusy(false)
        return
      }
      if (!res.ok) {
        setDelErr(j.error || 'Не удалось удалить проект')
        setDelBusy(false)
        return
      }
      setDelBusy(false)
      setConfirm(null)
      setCounts(null)
      router.refresh()
    } catch {
      setDelErr('Ошибка соединения')
      setDelBusy(false)
    }
  }

  const term = q.trim().toLowerCase()
  const filtered = term
    ? tenants.filter((t) => (t.name + ' ' + t.subdomain).toLowerCase().includes(term))
    : tenants

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--st-surface, #16161a)',
          border: '1px solid var(--st-border, rgba(255,255,255,0.12))',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 10px 40px rgba(0,0,0,0.20)',
        }}
      >
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: 'var(--st-text)' }}>Выберите проект</h1>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--st-text-muted)' }}>Платформенный доступ · {email}</p>

        {tenants.length > 8 && (
          <input
            className="studio-input"
            placeholder="Поиск проекта…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ marginBottom: 12 }}
          />
        )}

        {error && (
          <div className="studio-login__error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440, overflowY: 'auto' }}>
          {filtered.map((t) => {
            const isCurrent = t.id === currentId
            return (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 12,
                  border: `1px solid ${isCurrent ? 'var(--st-text-muted)' : 'var(--st-border, rgba(255,255,255,0.12))'}`,
                  background: 'var(--st-surface, #16161a)',
                  paddingRight: 8,
                  opacity: busy !== null && busy !== t.id ? 0.6 : 1,
                }}
              >
                <button
                  type="button"
                  onClick={() => pick(t.id)}
                  disabled={busy !== null}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    textAlign: 'left',
                    padding: '12px 14px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--st-text)',
                    cursor: busy !== null ? 'default' : 'pointer',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                    {t.subdomain && <div style={{ fontSize: 12, color: 'var(--st-text-muted)' }}>{t.subdomain}</div>}
                  </div>
                  {busy === t.id ? <Loader2 size={16} className="spin" /> : isCurrent ? <Check size={16} /> : null}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirm(t)
                    setCounts(null)
                    setDelErr(null)
                  }}
                  disabled={busy !== null}
                  title="Удалить проект"
                  aria-label={`Удалить проект ${t.name}`}
                  style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9, border: 'none', background: 'transparent', color: 'var(--st-text-muted)', cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--st-text-muted)', padding: '8px 2px' }}>Ничего не найдено.</div>
          )}
        </div>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <a
            href="/studio/logout"
            style={{ fontSize: 13, color: 'var(--st-text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <LogOut size={14} /> Выйти
          </a>
        </div>
      </div>

      {confirm && (
        <div
          onClick={() => !delBusy && setConfirm(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            style={{ width: '100%', maxWidth: 440, background: 'var(--st-surface, #16161a)', border: '1px solid var(--st-border, rgba(255,255,255,0.12))', borderRadius: 16, padding: 20, boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ display: 'inline-flex', width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, #ef4444 18%, transparent)', color: '#ef4444', flex: 'none' }}>
                <AlertTriangle size={18} />
              </span>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--st-text)' }}>Удалить «{confirm.name}»?</h3>
            </div>

            {counts ? (
              <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--st-text)' }}>
                В проекте есть контент: {Object.entries(counts).map(([k, v]) => `${v} ${COUNT_LABEL[k] || k}`).join(', ')}. Всё будет удалено <b>безвозвратно</b>.
              </p>
            ) : (
              <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--st-text-muted)' }}>
                Проект и все его данные будут удалены безвозвратно. Отменить нельзя.
              </p>
            )}

            {delErr && <div className="studio-login__error" style={{ margin: '10px 0 0' }}>{delErr}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="studio-btn studio-btn--ghost" onClick={() => setConfirm(null)} disabled={delBusy}>
                Отмена
              </button>
              <button
                onClick={() => runDelete(!!counts)}
                disabled={delBusy}
                className="studio-btn"
                style={{ background: '#ef4444', color: '#fff', border: 'none' }}
              >
                {delBusy ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}{' '}
                {counts ? 'Удалить с контентом' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
