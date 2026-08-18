'use client'
import React from 'react'
import { KeyRound, Loader2, Check, Trash2 } from 'lucide-react'

/**
 * Карточка подключения ИИ: владелец вводит ключ Аси (capability compose) прямо
 * в студии — альтернатива платформенному env. Значение ключа наружу не отдаётся,
 * показываем только статус (подключено из студии / env / не подключено).
 */
type Status = { hasKey: boolean; source: 'studio' | 'env' | 'none' }

export function AiKeyCard() {
  const [status, setStatus] = React.useState<Status | null>(null)
  const [value, setValue] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/studio/api/settings/ai-key', { credentials: 'include' })
      const j = await res.json().catch(() => null)
      if (res.ok && j?.ok) setStatus({ hasKey: !!j.hasKey, source: j.source || 'none' })
    } catch { /* ignore */ }
  }, [])

  React.useEffect(() => { void load() }, [load])

  async function save(key: string, clearing = false) {
    setBusy(true); setErr(null); setMsg(null)
    try {
      const res = await fetch('/studio/api/settings/ai-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok || !j?.ok) { setErr(j?.error || 'Не удалось сохранить'); return }
      setStatus({ hasKey: !!j.hasKey, source: j.source || 'none' })
      setValue('')
      setMsg(clearing ? 'Ключ удалён' : 'Ключ сохранён')
    } catch {
      setErr('Ошибка сети')
    } finally {
      setBusy(false)
    }
  }

  const badge = !status ? null
    : status.source === 'studio' ? <span className="aik__badge aik__badge--ok"><Check size={13} /> Подключено (ключ из студии)</span>
    : status.source === 'env' ? <span className="aik__badge aik__badge--env"><Check size={13} /> Подключено (платформенный ключ)</span>
    : <span className="aik__badge aik__badge--off">Не подключено</span>

  return (
    <section className="settings__block aik">
      <style dangerouslySetInnerHTML={{ __html: AIK_CSS }} />
      <div className="aik__head"><span className="aik__ico"><KeyRound size={16} /></span><b>Подключение ИИ (Ася)</b>{badge}</div>
      <p className="aik__lead">Ключ проекта в сервисе Ася (capability <code>compose</code>) для функции «Заполнить с помощью AI». Вставьте ключ здесь — он хранится в настройках вашего проекта. Если поле оставить пустым, используется платформенный ключ (если задан). Получить ключ можно на <a className="aik__link" href="https://api.xn--80a8a2b.online" target="_blank" rel="noopener noreferrer">api.ася.online</a>.</p>

      <div className="aik__row">
        <input
          type="password"
          className="studio-input aik__input"
          placeholder={status?.hasKey ? '••••••••••••••••' : 'Вставьте ключ Аси (asya_…)'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
        />
        <button type="button" className="studio-btn studio-btn--primary" disabled={busy || value.trim().length < 8} onClick={() => void save(value.trim())}>
          {busy ? <Loader2 size={16} className="aik__spin" /> : <Check size={16} />} Сохранить
        </button>
        {status?.source === 'studio' && (
          <button type="button" className="catmgr__icon-btn catmgr__icon-btn--danger" disabled={busy} onClick={() => void save('', true)} title="Удалить ключ из студии">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {status?.hasKey && <div className="aik__hint">Ключ сохранён (скрыт). Введите новый, чтобы заменить.</div>}
      {msg && <div className="aik__ok">{msg}</div>}
      {err && <div className="aik__err">{err}</div>}
    </section>
  )
}

const AIK_CSS = `
.aik{margin-bottom:16px}
.aik__head{display:flex;align-items:center;gap:9px;font-size:15px;color:var(--st-text);font-weight:700;margin-bottom:8px;flex-wrap:wrap}
.aik__ico{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:color-mix(in srgb,#2f6bed 12%,transparent);color:#2f6bed;flex:none}
.aik__badge{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;border-radius:999px;padding:3px 10px;margin-left:auto}
.aik__badge--ok{color:#1a7f4b;background:color-mix(in srgb,#1a7f4b 12%,transparent)}
.aik__badge--env{color:#2f6bed;background:color-mix(in srgb,#2f6bed 12%,transparent)}
.aik__badge--off{color:var(--st-text-muted);background:color-mix(in srgb,var(--st-text) 8%,transparent)}
.aik__lead{font-size:13px;color:var(--st-text-muted);line-height:1.5;margin:0 0 12px}
.aik__lead code{font-family:var(--st-font-mono);font-size:12px;background:color-mix(in srgb,var(--st-text) 7%,transparent);padding:1px 5px;border-radius:5px}
.aik__row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.aik__input{flex:1;min-width:220px}
.aik__clear{flex:none;width:42px;justify-content:center;color:#e5484d}
.aik__spin{animation:aikspin 1s linear infinite}
@keyframes aikspin{to{transform:rotate(360deg)}}
.aik__link{color:#2f6bed;text-decoration:underline}
.aik__hint{font-size:12px;color:var(--st-text-muted);margin-top:8px}
.aik__ok{font-size:13px;color:#1a7f4b;margin-top:10px}
.aik__err{font-size:13px;color:#e5484d;margin-top:10px}
`
