'use client'

import React, { useEffect, useState } from 'react'
import { Loader2, Check, CreditCard } from 'lucide-react'
import { StudioSelect } from '../_ui/StudioSelect'

/**
 * Настройки приёма платежей: магазин ЮKassa автора (Вариант 1). Owner-only.
 * Секрет наружу не отдаётся — при сохранённом ключе поле показывает плейсхолдер,
 * новый ключ отправляется только если его ввели заново.
 */
export function YookassaPanel() {
  const [loading, setLoading] = useState(true)
  const [shopId, setShopId] = useState('')
  const [secret, setSecret] = useState('')
  const [hasSecret, setHasSecret] = useState(false)
  const [mode, setMode] = useState<'test' | 'live'>('test')
  const [taxSystem, setTaxSystem] = useState('')
  const [vatCode, setVatCode] = useState('1')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/studio/api/settings/yookassa', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.ok) return
        setShopId(j.shopId || '')
        setHasSecret(!!j.hasSecret)
        setMode(j.mode === 'live' ? 'live' : 'test')
        setTaxSystem(j.taxSystem != null ? String(j.taxSystem) : '')
        setVatCode(j.vatCode != null ? String(j.vatCode) : '1')
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  async function save() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/studio/api/settings/yookassa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          shopId: shopId.trim(),
          ...(secret.trim() ? { secret: secret.trim() } : {}),
          mode,
          taxSystem: taxSystem.trim() ? Number(taxSystem) : null,
          vatCode: vatCode.trim() ? Number(vatCode) : 1,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) setError(j.error || 'Не удалось сохранить')
      else {
        setSaved(true)
        if (secret.trim()) { setHasSecret(true); setSecret('') }
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
        <h2><CreditCard size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />Приём платежей — ЮKassa</h2>
        <p>Подключите свой магазин ЮKassa: подписки и автопродление идут через него, деньги приходят вам напрямую. Для теста используйте тестовый shopId и тестовый секретный ключ из личного кабинета ЮKassa.</p>
      </div>

      {loading ? (
        <div className="an__empty"><Loader2 size={15} className="spin" /> Загрузка…</div>
      ) : (
        <div style={{ maxWidth: 520 }}>
          <label className="studio-field" style={{ display: 'block', marginBottom: 12 }}>
            <span className="studio-field__label">shopId</span>
            <input className="studio-input" value={shopId} onChange={(e) => setShopId(e.target.value)} placeholder="123456" spellCheck={false} style={{ width: '100%', boxSizing: 'border-box' }} />
          </label>

          <label className="studio-field" style={{ display: 'block', marginBottom: 12 }}>
            <span className="studio-field__label">Секретный ключ</span>
            <input className="studio-input" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={hasSecret ? '••••••••  (ключ сохранён — введите новый, чтобы заменить)' : 'test_… или live_…'} spellCheck={false} autoComplete="off" style={{ width: '100%', boxSizing: 'border-box' }} />
          </label>

          <div className="studio-field" style={{ display: 'block', marginBottom: 12 }}>
            <span className="studio-field__label">Режим</span>
            <StudioSelect
              value={mode}
              onChange={(v) => setMode(v === 'live' ? 'live' : 'test')}
              options={[{ value: 'test', label: 'Тест' }, { value: 'live', label: 'Боевой' }]}
              ariaLabel="Режим ЮKassa"
            />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
            <label className="studio-field" style={{ flex: '1 1 200px' }}>
              <span className="studio-field__label">СНО (код 1–6)</span>
              <input className="studio-input" type="number" min={1} max={6} value={taxSystem} onChange={(e) => setTaxSystem(e.target.value)} placeholder="напр. 2 (УСН доходы)" style={{ width: '100%', boxSizing: 'border-box' }} />
            </label>
            <label className="studio-field" style={{ flex: '1 1 200px' }}>
              <span className="studio-field__label">Ставка НДС (код 1–6)</span>
              <input className="studio-input" type="number" min={1} max={6} value={vatCode} onChange={(e) => setVatCode(e.target.value)} placeholder="1 = без НДС" style={{ width: '100%', boxSizing: 'border-box' }} />
            </label>
          </div>
          <p style={{ fontSize: 12, color: 'var(--st-text-muted)', marginTop: 4 }}>
            СНО и НДС нужны для чека 54-ФЗ по каждому платежу. Коды — из документации ЮKassa (СНО: 1 ОСН, 2 УСН доходы, 3 УСН доходы-расходы, 4 ЕНВД, 5 ЕСХН, 6 патент; НДС: 1 без НДС).
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <button type="button" className="studio-btn studio-btn--primary" onClick={save} disabled={saving}>
              {saving ? <><Loader2 size={14} className="spin" /> Сохраняю…</> : 'Сохранить'}
            </button>
            {saved && <span className="settings__saved"><Check size={15} /> Сохранено</span>}
            {error && <span className="settings__err">{error}</span>}
          </div>
        </div>
      )}
    </section>
  )
}
