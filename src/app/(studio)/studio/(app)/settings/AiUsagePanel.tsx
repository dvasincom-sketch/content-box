'use client'
import React from 'react'
import { Wallet, HardDrive, Sparkles, Zap, Percent, Info, Check, Loader2, FileText, Captions, MessageCircle } from 'lucide-react'
import type { AiUsageStats, AiSurfaceKey, AiSurfaceStat } from '@/lib/aiUsageStats'
import { RATE_IN_RUB_PER_M, RATE_OUT_RUB_PER_M } from '@/lib/aiPricing'
import { STORAGE_RATE_RUB, COMMISSION_RATE } from '@/lib/tariff'

/**
 * Раздел «Расходы и депозит» во вкладке «Тариф». Единый учёт расходов тенанта:
 *  1) хранилище (ГБ × ставка), 2) токены Аси, 3) доп. услуги (буст транскодинга).
 * Покрываются 10%-комиссией с платных подписок; остаток — из депозита автора.
 * Пока биллинга нет — показываем внесённый депозит и ориентировочное списание.
 */
export interface AiBilling {
  usage: AiUsageStats | null
  deposit: number
  storageRub: number // стоимость хранилища, ₽/мес
  commissionRub: number // покрытие комиссией с подписок, ₽/мес (10% × MRR)
  extrasRub: number // доп. услуги (буст транскодинга), ₽/мес
  usedGb: number
  mrrRub: number
}

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

export function AiUsagePanel({ data }: { data: AiBilling }) {
  const usage = data.usage
  const emptyStat: AiSurfaceStat = { calls: 0, tokensIn: 0, tokensOut: 0, costRub: 0 }
  const aiTotals = usage?.totals ?? emptyStat
  const months = usage?.months ?? []
  const aiThisMonth = months.length ? months[months.length - 1].costRub : 0

  const [deposit, setDeposit] = React.useState<number>(data.deposit || 0)
  const [editVal, setEditVal] = React.useState<string>(String(data.deposit || 0))
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

  // Расход за месяц: хранилище + токены Аси (за текущий месяц) + доп. услуги.
  const monthlyCost = data.storageRub + aiThisMonth + data.extrasRub
  const covered = Math.min(monthlyCost, data.commissionRub)
  const monthlyNet = Math.max(0, monthlyCost - data.commissionRub)

  // Списано с депозита всего (оценка): накопленные токены Аси + текущее хранилище/доп.,
  // за вычетом покрытия комиссией. Точное списание появится с биллингом.
  const grossSpend = aiTotals.costRub + data.storageRub + data.extrasRub
  const spent = Math.max(0, grossSpend - data.commissionRub)
  const balance = deposit - spent

  // Помесячно: токены Аси + хранилище (текущая ставка) − комиссия, с остатком депозита.
  const rows = months.map((m, i) => {
    const cost = m.costRub + data.storageRub + data.extrasRub
    const net = Math.max(0, cost - data.commissionRub)
    const cumNet = months.slice(0, i + 1).reduce((sum, x) => sum + Math.max(0, x.costRub + data.storageRub + data.extrasRub - data.commissionRub), 0)
    return { ...m, cost, net, balanceAfter: deposit - cumNet }
  })
  const rowsDesc = [...rows].reverse()

  const commissionPct = Math.round(COMMISSION_RATE * 100)

  return (
    <section className="settings__block aiu">
      <style dangerouslySetInnerHTML={{ __html: AIU_CSS }} />
      <div className="aiu__title"><Wallet size={18} /> Расходы и депозит</div>
      <p className="aiu__lead">
        Расходы проекта складываются из хранилища, токенов ассистента Аси и доп. услуг. При наличии платных подписок они покрываются {commissionPct}%-комиссией; пока подписок нет — из депозита автора.
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
          <div><span className="aiu__b-lbl">Израсходовано</span><span className="aiu__b-val">{rub(spent)}</span></div>
          <div><span className="aiu__b-lbl">Остаток</span><span className={`aiu__b-val ${balance < 0 ? 'aiu__neg' : 'aiu__pos'}`}>{rub(balance)}</span></div>
        </div>
        {deposit > 0 && (
          <div className="aiu__bar"><div className="aiu__bar-fill" style={{ width: `${Math.max(0, Math.min(100, (spent / deposit) * 100))}%` }} /></div>
        )}
      </div>

      {/* Расход за месяц — разбивка */}
      <div className="aiu__break">
        <div className="aiu__break-h">Расход за месяц (оценка)</div>
        <div className="aiu__line"><span className="aiu__l-ico"><HardDrive size={15} /></span><span className="aiu__l-name">Хранилище</span><span className="aiu__l-meta">{data.usedGb.toFixed(1)} ГБ × {fmt(STORAGE_RATE_RUB)} ₽</span><span className="aiu__l-val">{rub(data.storageRub)}</span></div>
        <div className="aiu__line"><span className="aiu__l-ico"><Sparkles size={15} /></span><span className="aiu__l-name">Токены Аси</span><span className="aiu__l-meta">за текущий месяц</span><span className="aiu__l-val">{rub(aiThisMonth)}</span></div>
        <div className="aiu__line"><span className="aiu__l-ico"><Zap size={15} /></span><span className="aiu__l-name">Доп. услуги (буст транскодинга)</span><span className="aiu__l-meta">по факту</span><span className="aiu__l-val">{rub(data.extrasRub)}</span></div>
        <div className="aiu__line aiu__line--sum"><span className="aiu__l-ico" /><span className="aiu__l-name">Итого за месяц</span><span className="aiu__l-meta" /><span className="aiu__l-val">{rub(monthlyCost)}</span></div>
        <div className="aiu__line aiu__line--cover"><span className="aiu__l-ico"><Percent size={15} /></span><span className="aiu__l-name">Покрыто подписками ({commissionPct}%)</span><span className="aiu__l-meta">{data.mrrRub > 0 ? `${commissionPct}% × ${fmt(data.mrrRub)} ₽/мес` : 'подписок пока нет'}</span><span className="aiu__l-val">−{rub(covered)}</span></div>
        <div className="aiu__line aiu__line--net"><span className="aiu__l-ico" /><span className="aiu__l-name">К списанию с депозита</span><span className="aiu__l-meta" /><span className="aiu__l-val">{rub(monthlyNet)}</span></div>
      </div>

      {/* Токены Аси — детализация */}
      <div className="aiu__ai">
        <div className="aiu__ai-h">Токены Аси — детализация</div>
        <p className="aiu__ai-rate">Ставки: вход <b>{fmt(RATE_IN_RUB_PER_M)} ₽/млн</b>, исход <b>{fmt(RATE_OUT_RUB_PER_M)} ₽/млн</b>.</p>
        <div className="aiu__grid">
          {SURFACES.map((s) => {
            const st = usage?.bySurface?.[s.key] ?? emptyStat
            return (
              <div className="aiu__card" key={s.key}>
                <div className="aiu__card-head"><span className="aiu__ico"><s.Icon size={16} /></span><b>{s.label}</b></div>
                <div className="aiu__cost">{rub(st.costRub)}</div>
                <div className="aiu__sub">вход {fmt(st.tokensIn)} · исход {fmt(st.tokensOut)} · {fmt(st.calls)} вызовов</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Помесячный биллинг */}
      <div className="aiu__bill">
        <div className="aiu__bill-h">Биллинг по месяцам</div>
        {rowsDesc.length === 0 && <div className="aiu__empty">Пока нет расходов — таблица заполнится по мере использования.</div>}
        {rowsDesc.length > 0 && (
          <table className="aiu__table">
            <thead>
              <tr><th>Месяц</th><th>Хранилище</th><th>Токены Аси</th><th>Итого</th><th>С депозита</th><th>Остаток</th></tr>
            </thead>
            <tbody>
              {rowsDesc.map((m) => (
                <tr key={m.month}>
                  <td>{monthLabel(m.month)}</td>
                  <td>{rub(data.storageRub)}</td>
                  <td>{rub(m.costRub)}</td>
                  <td><b>{rub(m.cost)}</b></td>
                  <td>{rub(m.net)}</td>
                  <td className={m.balanceAfter < 0 ? 'aiu__neg' : ''}>{rub(m.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="aiu__note"><Info size={14} /> Токены и стоимость — оценка по длине текста; хранилище и комиссия — по текущему состоянию. Точное списание подключится вместе с биллингом.</div>
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
.aiu__break{border:1px solid var(--st-border);border-radius:12px;padding:6px 14px;margin-bottom:16px}
.aiu__break-h{font-size:13px;font-weight:700;color:var(--st-text);margin:10px 0 6px}
.aiu__line{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed var(--st-border);font-size:13.5px}
.aiu__line:last-child{border-bottom:none}
.aiu__l-ico{width:24px;color:var(--st-text-muted);display:flex;justify-content:center;flex:none}
.aiu__l-name{flex:1;color:var(--st-text)}
.aiu__l-meta{font-size:12px;color:var(--st-text-muted);margin-right:10px}
.aiu__l-val{font-weight:700;color:var(--st-text);min-width:90px;text-align:right}
.aiu__line--sum .aiu__l-name,.aiu__line--sum .aiu__l-val{font-weight:800}
.aiu__line--cover .aiu__l-val{color:#1a7f4b}
.aiu__line--net .aiu__l-name,.aiu__line--net .aiu__l-val{font-weight:800;font-size:15px}
.aiu__ai{margin-bottom:16px}
.aiu__ai-h{font-size:13px;font-weight:700;color:var(--st-text);margin-bottom:4px}
.aiu__ai-rate{font-size:12.5px;color:var(--st-text-muted);margin:0 0 10px}
.aiu__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.aiu__card{border:1px solid var(--st-border);border-radius:12px;padding:12px;background:var(--st-surface);display:flex;flex-direction:column;gap:5px}
.aiu__card-head{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--st-text)}
.aiu__cost{font-size:18px;font-weight:800;color:var(--st-text)}
.aiu__sub{font-size:11.5px;color:var(--st-text-muted)}
.aiu__bill-h{font-size:13px;font-weight:700;color:var(--st-text);margin-bottom:8px}
.aiu__empty{font-size:13px;color:var(--st-text-muted);padding:12px;border:1px dashed var(--st-border);border-radius:12px}
.aiu__table{width:100%;border-collapse:collapse;font-size:13px}
.aiu__table th{text-align:right;font-weight:600;color:var(--st-text-muted);font-size:11px;text-transform:uppercase;letter-spacing:.03em;padding:6px 8px;border-bottom:1px solid var(--st-border)}
.aiu__table th:first-child{text-align:left}
.aiu__table td{text-align:right;padding:8px;border-bottom:1px solid color-mix(in srgb,var(--st-border) 60%,transparent);color:var(--st-text)}
.aiu__table td:first-child{text-align:left}
.aiu__note{display:flex;align-items:flex-start;gap:7px;font-size:12px;color:var(--st-text-muted);line-height:1.45;margin-top:14px}
.aiu__note svg{flex:none;margin-top:2px}
`
