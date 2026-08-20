'use client'

import React from 'react'
import { KeyRound, Loader2, Check, Copy, Trash2, RefreshCw, BookOpen } from 'lucide-react'

/**
 * Внешний API (owner-only): генерация/отзыв per-tenant ключа X-API-KEY для
 * переноса контента с других платформ и автоматизации. Значение ключа
 * показывается ОДИН раз при генерации — дальше только префикс и даты.
 */
type Status = { hasKey: boolean; prefix: string | null; createdAt: string | null; lastUsedAt: string | null }

function fmt(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

export function ExternalApiPanel() {
  const [status, setStatus] = React.useState<Status | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [freshKey, setFreshKey] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/studio/api/settings/external-api-key', { credentials: 'include' })
      const j = await res.json().catch(() => null)
      if (res.ok && j?.ok) setStatus({ hasKey: !!j.hasKey, prefix: j.prefix || null, createdAt: j.createdAt || null, lastUsedAt: j.lastUsedAt || null })
    } catch {
      /* ignore */
    }
  }, [])

  React.useEffect(() => { void load() }, [load])

  async function generate() {
    setBusy('gen'); setErr(null); setFreshKey(null); setCopied(false)
    try {
      const res = await fetch('/studio/api/settings/external-api-key', { method: 'POST', credentials: 'include' })
      const j = await res.json().catch(() => null)
      if (!res.ok || !j?.ok) { setErr(j?.error || 'Не удалось создать ключ'); return }
      setFreshKey(j.key)
      await load()
    } catch {
      setErr('Ошибка сети')
    } finally {
      setBusy(null)
    }
  }

  async function revoke() {
    setBusy('del'); setErr(null); setFreshKey(null)
    try {
      const res = await fetch('/studio/api/settings/external-api-key', { method: 'DELETE', credentials: 'include' })
      const j = await res.json().catch(() => null)
      if (!res.ok || !j?.ok) { setErr(j?.error || 'Не удалось отозвать'); return }
      await load()
    } catch {
      setErr('Ошибка сети')
    } finally {
      setBusy(null)
    }
  }

  function copyKey() {
    if (!freshKey) return
    try { void navigator.clipboard.writeText(freshKey); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <section className="settings__block extapi">
      <style dangerouslySetInnerHTML={{ __html: EXTAPI_CSS }} />
      <div className="extapi__head">
        <span className="extapi__ico"><KeyRound size={16} /></span>
        <b>Внешний API</b>
        {status?.hasKey ? <span className="extapi__badge extapi__badge--ok"><Check size={13} /> Ключ активен</span> : <span className="extapi__badge extapi__badge--off">Ключ не создан</span>}
      </div>
      <p className="extapi__lead">
        Ключ для программного создания публикаций — перенос контента с других платформ и автоматизация.
        Передавайте его в заголовке <code>X-API-KEY</code>. Значение ключа показывается один раз при создании —
        сохраните его. <a className="extapi__link" href="/api.html" target="_blank" rel="noopener noreferrer"><BookOpen size={13} /> Документация</a>
      </p>

      {freshKey && (
        <div className="extapi__fresh">
          <div className="extapi__fresh-label">Новый ключ (показывается один раз):</div>
          <div className="extapi__fresh-row">
            <code className="extapi__key">{freshKey}</code>
            <button type="button" className="studio-btn" onClick={copyKey}>{copied ? <><Check size={14} /> Скопировано</> : <><Copy size={14} /> Копировать</>}</button>
          </div>
          <div className="extapi__warn">Сохраните ключ сейчас — позже его нельзя будет посмотреть, только перегенерировать.</div>
        </div>
      )}

      {status?.hasKey && (
        <div className="extapi__meta">
          <span>Префикс: <code>{status.prefix || '—'}…</code></span>
          <span>Создан: {fmt(status.createdAt)}</span>
          <span>Последний вызов: {fmt(status.lastUsedAt)}</span>
        </div>
      )}

      <div className="extapi__row">
        <button type="button" className="studio-btn studio-btn--primary" disabled={busy === 'gen'} onClick={() => void generate()}>
          {busy === 'gen' ? <Loader2 size={15} className="extapi__spin" /> : <RefreshCw size={15} />}
          {status?.hasKey ? 'Перегенерировать' : 'Сгенерировать ключ'}
        </button>
        {status?.hasKey && (
          <button type="button" className="studio-btn" disabled={busy === 'del'} onClick={() => void revoke()} style={{ color: '#e5484d' }}>
            {busy === 'del' ? <Loader2 size={15} className="extapi__spin" /> : <Trash2 size={15} />} Отозвать
          </button>
        )}
      </div>

      {status?.hasKey && <div className="extapi__hint">Перегенерация немедленно отзывает прежний ключ.</div>}
      {err && <div className="extapi__err">{err}</div>}
    </section>
  )
}

const EXTAPI_CSS = `
.extapi{margin-bottom:16px}
.extapi__head{display:flex;align-items:center;gap:9px;font-size:15px;color:var(--st-text);font-weight:700;margin-bottom:8px;flex-wrap:wrap}
.extapi__ico{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:color-mix(in srgb,#7C3AED 12%,transparent);color:#7C3AED;flex:none}
.extapi__badge{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;border-radius:999px;padding:3px 10px;margin-left:auto}
.extapi__badge--ok{color:#1a7f4b;background:color-mix(in srgb,#1a7f4b 12%,transparent)}
.extapi__badge--off{color:var(--st-text-muted);background:color-mix(in srgb,var(--st-text) 8%,transparent)}
.extapi__lead{font-size:13px;color:var(--st-text-muted);line-height:1.55;margin:0 0 12px}
.extapi__lead code{font-family:var(--st-font-mono,ui-monospace,monospace);font-size:12px;background:color-mix(in srgb,var(--st-text) 7%,transparent);padding:1px 5px;border-radius:5px}
.extapi__link{color:#7C3AED;text-decoration:underline;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.extapi__fresh{border:1px solid color-mix(in srgb,#7C3AED 30%,transparent);background:color-mix(in srgb,#7C3AED 6%,transparent);border-radius:10px;padding:12px;margin-bottom:12px}
.extapi__fresh-label{font-size:12px;color:var(--st-text-muted);margin-bottom:6px}
.extapi__fresh-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.extapi__key{flex:1;min-width:220px;font-family:var(--st-font-mono,ui-monospace,monospace);font-size:12.5px;word-break:break-all;background:color-mix(in srgb,var(--st-text) 7%,transparent);padding:8px 10px;border-radius:8px}
.extapi__warn{font-size:12px;color:#b45309;margin-top:8px}
.extapi__meta{display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:var(--st-text-muted);margin-bottom:12px}
.extapi__meta code{font-family:var(--st-font-mono,ui-monospace,monospace)}
.extapi__row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.extapi__spin{animation:extapispin 1s linear infinite}
@keyframes extapispin{to{transform:rotate(360deg)}}
.extapi__hint{font-size:12px;color:var(--st-text-muted);margin-top:8px}
.extapi__err{font-size:13px;color:#e5484d;margin-top:10px}
`
