'use client'
import React from 'react'
import { Sparkles, FileText, Captions, MessageCircle, Info, Wallet, Check, Loader2 } from 'lucide-react'
import type { AiUsageStats, AiSurfaceKey, AiSurfaceStat } from '@/lib/aiUsageStats'
import { RATE_IN_RUB_PER_M, RATE_OUT_RUB_PER_M } from '@/lib/aiPricing'

/**
 * Подраздел «AI» во вкладке «Тариф»: стоимость токенов Аси (вход/исход), разбивка
 * по поверхностям, помесячный биллинг и депозит с ежемесячным списанием.
 * Токены и стоимость — оценочные.
 */
const SURFACES: { key: AiSurfaceKey; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'compose', label: 'Создание страниц', Icon: FileText },
  { key: 'summary', label: 'Саммари субтитров', Icon: Captions },
  { key: 'support', label: 'Поддержка на сайте', Icon: MessageCircle },
]

const nf = new Intl.NumberFormat('ru-RU')
const rf = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 })
const fmt = (n: number) => nf.format(Math.round(n || 0))
const rub = (n: number) => rf.format(n || 0)
const monthLabel = (m: string) => {
  const [y, mo] = m.split('-')
  const names = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
  return `${names[Number(mo) - 1] || mo} ${y}`
}

export function AiUsagePanel({ data, deposit: initialDeposit }: { data: AiUsageStats | null; deposit: number }) {
  const empty: AiSurfaceStat = { calls: 0, tokensIn: 0, tokensOut: 0, costRub: 0 }
  const totals = data?.totals ?? empty
  const bySurface = data?.bySurface
  const months = data?.months ?? []

  const [deposit, setDeposit] = React.useState<number>(initialDeposit || 0)
  const [editVal, setEditVal] = React.useState<string>(String(initialDeposit || 0))
  const [saving, setSaving] = React.useState(false)
  const [savedMsg, setSavedMsg] = React.useState<string | null>(null)

  async function saveDeposit() {
    const rubVal = Math.max(0, Math.round(Number(editVal) || 0))
    setSaving(true); setSavedMsg(null)
    try {
      const res = await fetch('/studio/api/settings/ai-deposit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ rub: rubVal }),
      })
      const j = await res.json().catch(() => null)
      if (res.ok && j?.ok) { setDeposit(j.deposit ?? rubVal); setSavedMsg('Сохранено') }
      else setSavedMsg('Не сохранилось')
    } catch { setSavedMsg('Ошибка сети') } finally { setSaving(false) }
  }

  const balance = deposit - totals.costRub

  // Помесячно с накопительным списанием и остатком депозита на конец месяца.
  const rows = months.map((m, i) => {
    const spentToDate = months.slice(0, i + 1).reduce((sum, x) => sum + x.costRub, 0)
    return { ...m, balanceAfter: deposit - spentToDate }
  })
  const rowsDesc = [...rows].reverse()

  return (
    <section className="settings__block aiu">
      <style dangerouslySetInnerHTML={{ __html: AIU_CSS }} />
      <div className="aiu__title"><Sparkles size={18} /> Ассистент Ася — расход и биллинг</div>
      <p className="aiu__lead">
        Стоимость токенов: вход <b>{fmt(RATE_IN_RUB_PER_M)} ₽/млн</b> ({fmt(RATE_IN_RUB_PER_M / 10)} ₽ за 100 тыс.), исход <b>{fmt(RATE_OUT_RUB_PER_M)} ₽/млн</b> ({fmt(RATE_OUT_RUB_PER_M / 10)} ₽ за 100 тыс.). Списывается из депозита.
      </p>

      {/* Депозит и баланс */}
      <div className="aiu__deposit">
        <div className="aiu__dep-row">
          <span className="aiu__ico"><Wallet size={16} /></span>
          <label className="aiu__dep-field">Депозит, ₽
            <input type="number" min={0} step={1000} className="studio-input aiu__dep-input" value={editVal} onChange={(e) => setEditVal(e.target.value)} />
          </label>
          <button type="button" className="studio-btn studio-btn--ghost" disabled={saving} onClick={() => void saveDeposit()}>
            {saving ? <Loader2 size={15} className="aiu__spin" /> : <Check size={15} />} Сохранить
          </button>
          {savedMsg && <span className="aiu__saved">{savedMsg}</span>}
        </div>
        <div className="aiu__balance">
          <div><span className="aiu__b-lbl">Внесено</span><span className="aiu__b-val">{rub(deposit)}</span></div>
          <div><span className="aiu__b-lbl">Израсходовано</span><span className="aiu__b-val">{rub(totals.costRub)}</span></div>
          <div><span className="aiu__b-lbl">Остаток</span><span className={`aiu__b-val ${balance < 0 ? 'aiu__neg' : 'aiu__pos'}`}>{rub(balance)}</span></div>
        </div>
        {deposit > 0 && (
          <div className="aiu__bar"><div className="aiu__bar-fill" style={{ width: `${Math.max(0, Math.min(100, (totals.costRub / deposit) * 100))}%` }} /></div>
        )}
      </div>

      {/* Итоги по поверхностям */}
      <div className="aiu__grid">
        {SURFACES.map((s) => {
          const st = bySurface?.[s.key] ?? empty
          return (
            <div className="aiu__card" key={s.key}>
              <div className="aiu__card-head"><span className="aiu__ico"><s.Icon size={16} /></span><b>{s.label}</b></div>
              <div className="aiu__cost">{rub(st.costRub)}</div>
              <div className="aiu__sub">вход {fmt(st.tokensIn)} · исход {fmt(st.tokensOut)} токенов · {fmt(st.calls)} вызовов</div>
            </div>
          )
        })}
      </div>

      {/* Помесячный биллинг */}
      <div className="aiu__bill">
        <div className="aiu__bill-h">Биллинг по месяцам</div>
        {rowsDesc.length === 0 && <div className="aiu__empty">Пока нет расходов — таблица заполнится, как только Ася поработает.</div>}
        {rowsDesc.length > 0 && (
          <table className="aiu__table">
            <thead>
              <tr><th>Месяц</th><th>Вызовы</th><th>Вход</th><th>Исход</th><th>Стоимость</th><th>Остаток</th></tr>
            </thead>
            <tbody>
              {rowsDesc.map((m) => (
                <tr key={m.month}>
                  <td>{monthLabel(m.month)}</td>
                  <td>{fmt(m.calls)}</td>
                  <td>{fmt(m.tokensIn)}</td>
                  <td>{fmt(m.tokensOut)}</td>
                  <td><b>{rub(m.costRub)}</b></td>
                  <td className={m.balanceAfter < 0 ? 'aiu__neg' : ''}>{rub(m.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="aiu__note"><Info size={14} /> Токены и стоимость — оценка по длине текста (Ася пока не возвращает точный расход). Списание с депозита ориентировочное.</div>
    </section>
  )
}

const AIU_CSS = `
.aiu__title{display:flex;align-items:center;gap:9px;font-weight:700;font-size:16px;color:var(--st-text);margin-bottom:6px}
.aiu__lead{font-size:13px;color:var(--st-text-muted);line-height:1.5;margin:0 0 16px}
.aiu__ico{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:color-mix(in srgb,#2f6bed 12%,transparent);color:#2f6bed;flex:none}
.aiu__deposit{border:1px solid var(--st-border);border-radius:12px;padding:14px;margin-bottom:16px;background:color-mix(in srgb,var(--st-text) 2%,transparent)}
.aiu__dep-row{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.aiu__dep-field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--st-text-muted)}
.aiu__dep-input{width:160px}
.aiu__saved{font-size:12.5px;color:#1a7f4b;align-self:center}
.aiu__spin{animation:aiuspin 1s linear infinite}
@keyframes aiuspin{to{transform:rotate(360deg)}}
.aiu__balance{display:flex;gap:20px;flex-wrap:wrap}
.aiu__balance>div{display:flex;flex-direction:column;gap:2px}
.aiu__b-lbl{font-size:11.5px;color:var(--st-text-muted)}
.aiu__b-val{font-size:19px;font-weight:800;color:var(--st-text)}
.aiu__pos{color:#1a7f4b}.aiu__neg{color:#e5484d}
.aiu__bar{height:8px;border-radius:999px;background:color-mix(in srgb,var(--st-text) 10%,transparent);margin-top:12px;overflow:hidden}
.aiu__bar-fill{height:100%;background:#2f6bed;border-radius:999px}
.aiu__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px}
.aiu__card{border:1px solid var(--st-border);border-radius:12px;padding:14px;background:var(--st-surface);display:flex;flex-direction:column;gap:6px}
.aiu__card-head{display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--st-text)}
.aiu__cost{font-size:20px;font-weight:800;color:var(--st-text)}
.aiu__sub{font-size:12px;color:var(--st-text-muted)}
.aiu__bill-h{font-size:13px;font-weight:700;color:var(--st-text);margin-bottom:8px}
.aiu__empty{font-size:13px;color:var(--st-text-muted);padding:12px;border:1px dashed var(--st-border);border-radius:12px}
.aiu__table{width:100%;border-collapse:collapse;font-size:13px}
.aiu__table th{text-align:right;font-weight:600;color:var(--st-text-muted);font-size:11.5px;text-transform:uppercase;letter-spacing:.03em;padding:6px 8px;border-bottom:1px solid var(--st-border)}
.aiu__table th:first-child{text-align:left}
.aiu__table td{text-align:right;padding:8px;border-bottom:1px solid color-mix(in srgb,var(--st-border) 60%,transparent);color:var(--st-text)}
.aiu__table td:first-child{text-align:left}
.aiu__note{display:flex;align-items:flex-start;gap:7px;font-size:12px;color:var(--st-text-muted);line-height:1.45;margin-top:14px}
.aiu__note svg{flex:none;margin-top:2px}
`
