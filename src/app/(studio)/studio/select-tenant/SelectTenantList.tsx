'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, LogOut } from 'lucide-react'

type TenantRow = { id: number; name: string; subdomain: string }

/**
 * Клиентский список проектов для superadmin. Клик по проекту → POST в
 * /studio/api/select-tenant (ставит cookie активного тенанта) → редирект в
 * студию выбранного проекта. Стили — токены студии (--st-*) + классы
 * studio-input/spin, чтобы совпасть с остальной студией.
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
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
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
              <button
                key={t.id}
                type="button"
                onClick={() => pick(t.id)}
                disabled={busy !== null}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: 12,
                  cursor: busy !== null ? 'default' : 'pointer',
                  background: 'var(--st-surface, #16161a)',
                  border: `1px solid ${isCurrent ? 'var(--st-text-muted)' : 'var(--st-border, rgba(255,255,255,0.12))'}`,
                  color: 'var(--st-text)',
                  opacity: busy !== null && busy !== t.id ? 0.6 : 1,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                  {t.subdomain && <div style={{ fontSize: 12, color: 'var(--st-text-muted)' }}>{t.subdomain}</div>}
                </div>
                {busy === t.id ? <Loader2 size={16} className="spin" /> : isCurrent ? <Check size={16} /> : null}
              </button>
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
    </div>
  )
}
