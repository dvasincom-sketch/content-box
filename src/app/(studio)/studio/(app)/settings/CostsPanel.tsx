'use client'
import React from 'react'
import {
  LayoutDashboard, Wallet, HardDrive, Sparkles, Zap, Percent, Info,
  FileText, Captions, MessageCircle, TrendingUp, Image as ImageIcon, Music, Images, FileDown, Video as VideoIcon,
} from 'lucide-react'
import { formatBytes, type MediaSourceStat } from '@/lib/mediaStats'
import { STORAGE_RATE_RUB, COMMISSION_RATE } from '@/lib/tariff'
import { RATE_IN_RUB_PER_M, RATE_OUT_RUB_PER_M } from '@/lib/aiPricing'
import type { AiBilling, AiSurfaceKey, AiSurfaceStat } from '@/lib/aiUsageStats'
import type { TariffPanelData } from './TariffPanel'
import { AiKeyCard } from './AiKeyCard'

/**
 * Единый раздел расходов во вкладке «Тариф». Структура: Дашборд (расход за месяц +
 * остаток депозита) → Хранилище (+доп. услуги) → AI-ассистент (ключ + сервисы) →
 * Платформенный сбор → Биллинг по месяцам. Токены/стоимость — оценка.
 */
const nf = new Intl.NumberFormat('ru-RU')
const rf = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 })
const fmt = (n: number) => nf.format(Math.round(n || 0))
const rub = (n: number) => rf.format(n || 0)
const GB = 1024 * 1024 * 1024
const gb = (bytes: number) => `${(Math.max(0, bytes || 0) / GB).toFixed(1).replace('.', ',')} ГБ`
const monthLabel = (m: string) => {
  const [y, mo] = m.split('-')
  const names = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
  return `${names[Number(mo) - 1] || mo} ${y}`
}
function sourceIcon(key: MediaSourceStat['key']): React.ReactNode {
  switch (key) {
    case 'audio': return <Music size={15} />
    case 'gallery': return <Images size={15} />
    case 'downloads': return <FileDown size={15} />
    case 'video': return <VideoIcon size={15} />
    default: return <ImageIcon size={15} />
  }
}

const AI_SERVICES: { key: AiSurfaceKey; label: string; hint: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'compose', label: 'Генерация страниц', hint: 'Разбор текста на блоки', Icon: FileText },
  { key: 'summary', label: 'Сервис саммари', hint: 'Краткое содержание видео', Icon: Captions },
  { key: 'support', label: 'Сервис поддержки', hint: 'Ответы зрителям на сайте', Icon: MessageCircle },
]

export function CostsPanel({ tariff, ai }: { tariff: TariffPanelData | null; ai: AiBilling }) {
  const t = tariff?.tariff ?? null
  const sources = (tariff?.sources ?? []).filter((s) => s.files > 0 || s.bytes > 0)
  const usage = ai.usage
  const emptyStat: AiSurfaceStat = { calls: 0, tokensIn: 0, tokensOut: 0, costRub: 0 }
  const aiTotals = usage?.totals ?? emptyStat
  const months = usage?.months ?? []
  const aiThisMonth = months.length ? months[months.length - 1].costRub : 0

  const deposit = ai.deposit || 0
  const [topupOpen, setTopupOpen] = React.useState(false)
  const [topupAmt, setTopupAmt] = React.useState(50000)

  const storageRub = ai.storageRub
  const commission = ai.commissionRub
  const extras = ai.extrasRub
  const aiMonth = aiThisMonth
  // Модель: платформенный сбор за месяц = генерация (токены Аси) + 10% с выручки.
  // Стоимость хранилища ВХОДИТ в комиссию 10% (не добавляется сверху). С депозита
  // списывается генерация сверх комиссии; хранилище с депозита не берётся.
  const monthTotal = aiMonth + extras + commission
  const depositMonth = Math.max(0, aiMonth + extras - commission)

  const spent = months.reduce((sum, m) => sum + Math.max(0, m.costRub + extras - commission), 0)
  const balance = deposit - spent

  const rows = months.map((m, i) => {
    const total = m.costRub + commission
    const fromDeposit = Math.max(0, m.costRub + extras - commission)
    const cum = months.slice(0, i + 1).reduce((sum, x) => sum + Math.max(0, x.costRub + extras - commission), 0)
    return { ...m, total, fromDeposit, balanceAfter: deposit - cum }
  })
  const rowsDesc = [...rows].reverse()
  const curMonth = months.length ? monthLabel(months[months.length - 1].month) : 'текущий месяц'

  const commissionPct = Math.round(COMMISSION_RATE * 100)
  const usagePct = t && t.grade.ceilingGb > 0 ? Math.min(100, Math.round((t.usedGb / t.grade.ceilingGb) * 100)) : 0

  return (
    <div className="cp">
      <style dangerouslySetInnerHTML={{ __html: CP_CSS }} />

      {/* ── 1. Дашборд ─────────────────────────────────────────────── */}
      <section className="settings__block cp__block">
        <div className="cp__head"><LayoutDashboard size={17} /> Дашборд расходов</div>
        {t?.trialActive && (
          <div className="cp__trial"><Info size={15} /> Триал — {t.trialDaysLeft} дн. осталось. Платформенный сбор 0 ₽ до конца триала.</div>
        )}

        <div className="cp__hero">
          <div className="cp__hero-tile">
            <div className="cp__hero-lbl">Платформенный сбор за месяц</div>
            <div className="cp__hero-val">{rub(monthTotal)}</div>
            <div className="cp__hero-sub">генерация + {commissionPct}% комиссии · хранилище в комиссии</div>
          </div>
          <div className="cp__hero-tile">
            <div className="cp__hero-lbl">К списанию с депозита</div>
            <div className="cp__hero-val">{rub(depositMonth)}</div>
            <div className="cp__hero-sub">генерация − комиссия (оценка)</div>
          </div>
          <div className="cp__hero-tile cp__hero-tile--dep">
            <div className="cp__hero-lbl">Остаток депозита</div>
            <div className={`cp__hero-val ${balance < 0 ? 'cp__neg' : ''}`}>{rub(balance)}</div>
            <div className="cp__hero-sub">внесено {rub(deposit)} · израсходовано {rub(spent)}</div>
          </div>
        </div>

        <div className="cp__depctl">
          <button type="button" className="studio-btn studio-btn--primary" onClick={() => setTopupOpen((o) => !o)}><Wallet size={15} /> Пополнить депозит</button>
          <span className="cp__dep-note">Пополнение — через оплату (YooKassa). Сейчас депозит зачисляет администратор платформы.</span>
        </div>
        {topupOpen && (
          <div className="cp__topup">
            <div className="cp__topup-h">Пополнить депозит</div>
            <div className="cp__topup-amts">
              {[5000, 10000, 50000, 100000].map((a) => (
                <button key={a} type="button" className={`cp__amt${topupAmt === a ? ' is-on' : ''}`} onClick={() => setTopupAmt(a)}>{fmt(a)} ₽</button>
              ))}
            </div>
            <div className="cp__topup-row">
              <button type="button" className="studio-btn studio-btn--primary" disabled title="Приём платежей скоро">Оплатить {fmt(topupAmt)} ₽ через YooKassa</button>
              <span className="cp__soon">Скоро</span>
            </div>
            <p className="cp__topup-note">Приём платежей подключается вместе с биллингом. Пока пополнение депозита делает администратор платформы.</p>
          </div>
        )}
        {deposit > 0 && <div className="cp__bar" title="Остаток депозита"><div className="cp__bar-fill cp__bar-fill--ok" style={{ width: `${Math.max(0, Math.min(100, (balance / deposit) * 100))}%` }} /></div>}

        {/* Мини-статистика */}
        <div className="cp__stats">
          <div><b>{t ? gb(t.usedBytes) : '—'}</b><span>хранилище</span></div>
          <div><b>{fmt(aiTotals.tokensIn + aiTotals.tokensOut)}</b><span>токенов Аси</span></div>
          <div><b>{fmt(aiTotals.calls)}</b><span>вызовов Аси</span></div>
          <div><b>{rub(ai.mrrRub)}</b><span>выручка/мес</span></div>
        </div>
      </section>

      {/* ── 2. Хранилище ───────────────────────────────────────────── */}
      <section className="settings__block cp__block">
        <div className="cp__head"><HardDrive size={17} /> Хранилище</div>
        {t ? (
          <>
            <div className="cp__two">
              <div className="cp__tile"><div className="cp__tile-val">{gb(t.usedBytes)}</div><div className="cp__tile-lbl">Занято место</div></div>
              <div className="cp__tile"><div className="cp__tile-val">{t.grade.ceilingGb} ГБ</div><div className="cp__tile-lbl">Потолок грейда «{t.grade.label}»</div></div>
            </div>
            <div className="cp__bar cp__bar--tall"><div className="cp__bar-fill" style={{ width: `${usagePct}%`, background: t.overCeiling ? '#dc2626' : usagePct > 80 ? '#f59e0b' : '#7c3aed' }} /></div>
            <div className="cp__bar-cap"><span>{usagePct}% потолка</span>{t.nextGrade ? <span><TrendingUp size={12} /> дальше: «{t.nextGrade.label}» — до {t.nextGrade.ceilingGb} ГБ</span> : <span>максимальный грейд</span>}</div>
            {sources.length > 0 && (
              <div className="cp__break">
                {sources.map((s) => (
                  <div key={s.key} className="cp__brk-row"><span className="cp__brk-ico">{sourceIcon(s.key)}</span><span className="cp__brk-lbl">{s.label}</span><span className="cp__brk-cnt">{s.files} файл.</span><span className="cp__brk-size">{formatBytes(s.bytes)}</span></div>
                ))}
              </div>
            )}
            <div className="cp__line cp__line--extra"><span className="cp__l-ico"><HardDrive size={15} /></span><span className="cp__l-name">Стоимость хранилища</span><span className="cp__l-meta">{gb(t.usedBytes)} × {STORAGE_RATE_RUB} ₽/ГБ</span><span className="cp__l-val">{rub(storageRub)}/мес</span></div>
            <div className="cp__line"><span className="cp__l-ico"><Zap size={15} /></span><span className="cp__l-name">Доп. услуги (буст транскодинга)</span><span className="cp__l-meta">по факту использования</span><span className="cp__l-val">{rub(extras)}</span></div>
          </>
        ) : <div className="cp__empty">Не удалось посчитать хранилище — обновите страницу.</div>}
      </section>

      {/* ── 3. AI-ассистент ────────────────────────────────────────── */}
      <section className="settings__block cp__block">
        <div className="cp__head"><Sparkles size={17} /> AI-ассистент (Ася)</div>
        <p className="cp__muted">Ставки токенов: вход <b>{fmt(RATE_IN_RUB_PER_M)} ₽/млн</b>, исход <b>{fmt(RATE_OUT_RUB_PER_M)} ₽/млн</b>. Всего за всё время: <b>{rub(aiTotals.costRub)}</b>.</p>
        <div className="cp__svc">
          {AI_SERVICES.map((s) => {
            const st = usage?.bySurface?.[s.key] ?? emptyStat
            return (
              <div key={s.key} className="cp__svc-card">
                <div className="cp__svc-head"><span className="cp__ico"><s.Icon size={15} /></span><b>{s.label}</b></div>
                <div className="cp__svc-hint">{s.hint}</div>
                <div className="cp__svc-cost">{rub(st.costRub)}</div>
                <div className="cp__svc-sub">вход {fmt(st.tokensIn)} · исход {fmt(st.tokensOut)} · {fmt(st.calls)} выз.</div>
              </div>
            )
          })}
        </div>
        <div className="cp__key"><AiKeyCard /></div>
      </section>

      {/* ── 4. Платформенный сбор за текущий месяц ─────────────────── */}
      <section className="settings__block cp__block">
        <div className="cp__head"><Percent size={17} /> Платформенный сбор за текущий месяц</div>
        <p className="cp__muted">Сумма за месяц = генерация (токены Аси) + {commissionPct}% с выручки платных подписок. Стоимость хранилища входит в комиссию {commissionPct}% и не добавляется сверху. Суммы оценочные — приём платежей ещё не подключён.</p>
        <div className="cp__line"><span className="cp__l-ico"><HardDrive size={15} /></span><span className="cp__l-name">Стоимость хранилища</span><span className="cp__l-meta">входит в комиссию {commissionPct}%</span><span className="cp__l-val">{rub(storageRub)}</span></div>
        <div className="cp__line"><span className="cp__l-ico"><Sparkles size={15} /></span><span className="cp__l-name">Генерация страниц (токены Аси)</span><span className="cp__l-meta">за месяц</span><span className="cp__l-val">{rub(aiMonth)}</span></div>
        {extras > 0 && <div className="cp__line"><span className="cp__l-ico"><Zap size={15} /></span><span className="cp__l-name">Доп. услуги (буст транскодинга)</span><span className="cp__l-meta">по факту</span><span className="cp__l-val">{rub(extras)}</span></div>}
        <div className="cp__line"><span className="cp__l-ico"><Percent size={15} /></span><span className="cp__l-name">{commissionPct}% с выручки платных подписок</span><span className="cp__l-meta">выручка {rub(ai.mrrRub)}/мес (оценка)</span><span className="cp__l-val">{rub(commission)}</span></div>
        <div className="cp__fee"><span>Итого за {curMonth} на текущий момент</span><b>{rub(monthTotal)}</b></div>
        <div className="cp__feesub">С депозита: генерация {rub(aiMonth + extras)} − комиссия {rub(commission)} = <b>{rub(depositMonth)}</b>. Хранилище с депозита не списывается.</div>
      </section>

      {/* ── 5. Биллинг по месяцам ──────────────────────────────────── */}
      <section className="settings__block cp__block">
        <div className="cp__head">Биллинг по прошлым месяцам</div>
        {rowsDesc.length === 0 && <div className="cp__empty">Пока нет расходов — таблица заполнится по мере использования.</div>}
        {rowsDesc.length > 0 && (
          <table className="cp__table">
            <thead><tr><th>Месяц</th><th>Токены Аси</th><th>Комиссия {commissionPct}%</th><th>Итого</th><th>С депозита</th><th>Остаток</th></tr></thead>
            <tbody>
              {rowsDesc.map((m) => (
                <tr key={m.month}>
                  <td>{monthLabel(m.month)}</td>
                  <td>{rub(m.costRub)}</td>
                  <td>{rub(commission)}</td>
                  <td><b>{rub(m.total)}</b></td>
                  <td>{rub(m.fromDeposit)}</td>
                  <td className={m.balanceAfter < 0 ? 'cp__neg' : ''}>{rub(m.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="cp__note"><Info size={13} /> Токены и стоимость — оценка по длине текста; хранилище и комиссия — по текущему состоянию. Точное списание подключится вместе с биллингом.</div>
      </section>
    </div>
  )
}

const CP_CSS = `
.cp__block{margin-bottom:16px}
.cp__head{display:flex;align-items:center;gap:9px;font-weight:700;font-size:16px;color:var(--st-text);margin-bottom:12px}
.cp__muted{font-size:13px;color:var(--st-text-muted);line-height:1.5;margin:0 0 12px}
.cp__ico{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:color-mix(in srgb,#2f6bed 12%,transparent);color:#2f6bed;flex:none}
.cp__trial{display:flex;align-items:center;gap:8px;font-size:13px;color:#7c3aed;background:color-mix(in srgb,#7c3aed 9%,transparent);border:1px solid color-mix(in srgb,#7c3aed 22%,transparent);border-radius:10px;padding:9px 12px;margin-bottom:14px}
.cp__hero{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:14px}
.cp__hero-tile{border:1px solid var(--st-border);border-radius:12px;padding:14px 16px;background:var(--st-surface)}
.cp__hero-tile--dep{background:color-mix(in srgb,#2f6bed 6%,transparent);border-color:color-mix(in srgb,#2f6bed 22%,transparent)}
.cp__hero-lbl{font-size:12px;color:var(--st-text-muted)}
.cp__hero-val{font-size:26px;font-weight:800;color:var(--st-text);line-height:1.15;margin:3px 0}
.cp__hero-sub{font-size:11.5px;color:var(--st-text-muted)}
.cp__neg{color:#e5484d}
.cp__depctl{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.cp__dep-note{font-size:12px;color:var(--st-text-muted);align-self:center;line-height:1.4}
.cp__topup{border:1px solid var(--st-border);border-radius:12px;padding:14px;margin-top:12px;background:color-mix(in srgb,var(--st-text) 2%,transparent)}
.cp__topup-h{font-size:13px;font-weight:700;color:var(--st-text);margin-bottom:10px}
.cp__topup-amts{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.cp__amt{border:1px solid var(--st-border);background:var(--st-surface);color:var(--st-text);border-radius:9px;padding:7px 14px;cursor:pointer;font-size:13px;font-weight:600}
.cp__amt.is-on{border-color:#2f6bed;background:color-mix(in srgb,#2f6bed 12%,transparent);color:#2f6bed}
.cp__topup-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.cp__soon{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--st-text-muted);background:color-mix(in srgb,var(--st-text) 8%,transparent);border-radius:999px;padding:3px 9px}
.cp__topup-note{font-size:12px;color:var(--st-text-muted);line-height:1.45;margin:10px 0 0}
.cp__spin{animation:cpspin 1s linear infinite}
@keyframes cpspin{to{transform:rotate(360deg)}}
.cp__bar{height:8px;border-radius:999px;background:color-mix(in srgb,var(--st-text) 10%,transparent);overflow:hidden;margin:4px 0}
.cp__bar--tall{height:10px;margin:12px 0 6px}
.cp__bar-fill{height:100%;background:#2f6bed;border-radius:999px;transition:width .3s ease}
.cp__bar-fill--ok{background:#1a7f4b}
.cp__bar-cap{display:flex;justify-content:space-between;font-size:12px;color:var(--st-text-muted);margin-bottom:8px}
.cp__bar-cap span{display:inline-flex;align-items:center;gap:4px}
.cp__stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:8px;padding-top:12px;border-top:1px dashed var(--st-border)}
.cp__stats>div{display:flex;flex-direction:column}
.cp__stats b{font-size:16px;color:var(--st-text)}
.cp__stats span{font-size:11.5px;color:var(--st-text-muted)}
.cp__two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:6px}
.cp__tile{border:1px solid var(--st-border);border-radius:12px;padding:14px 16px;background:var(--st-surface)}
.cp__tile--pick{outline:2px solid #7c3aed;outline-offset:2px}
.cp__tile-val{font-size:22px;font-weight:800;color:var(--st-text)}
.cp__tile-lbl{font-size:12px;color:var(--st-text-muted);margin-top:2px}
.cp__break{margin-top:12px;display:flex;flex-direction:column;gap:2px}
.cp__brk-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px dashed var(--st-border);font-size:13px}
.cp__brk-row:last-child{border-bottom:none}
.cp__brk-ico{color:var(--st-text-muted)}
.cp__brk-lbl{flex:1;color:var(--st-text)}
.cp__brk-cnt{font-size:12px;color:var(--st-text-muted)}
.cp__brk-size{font-weight:700;min-width:80px;text-align:right}
.cp__line{display:flex;align-items:center;gap:10px;padding:10px 0 2px;font-size:13.5px}
.cp__line--extra{margin-top:8px;border-top:1px solid var(--st-border)}
.cp__l-ico{width:24px;color:var(--st-text-muted);display:flex;justify-content:center;flex:none}
.cp__l-name{flex:1;color:var(--st-text)}
.cp__l-meta{font-size:12px;color:var(--st-text-muted);margin-right:10px}
.cp__l-val{font-weight:700;min-width:80px;text-align:right}
.cp__svc{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:14px}
.cp__svc-card{border:1px solid var(--st-border);border-radius:12px;padding:12px;background:var(--st-surface);display:flex;flex-direction:column;gap:4px}
.cp__svc-head{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--st-text)}
.cp__svc-hint{font-size:11.5px;color:var(--st-text-muted);min-height:28px}
.cp__svc-cost{font-size:18px;font-weight:800;color:var(--st-text)}
.cp__svc-sub{font-size:11px;color:var(--st-text-muted)}
.cp__key{margin-top:4px}
.cp__fee{display:flex;flex-direction:column;gap:4px;margin-top:12px;padding:14px 16px;border-radius:12px;background:color-mix(in srgb,var(--st-text) 4%,transparent)}
.cp__fee span{font-size:13px;color:var(--st-text-muted)}
.cp__fee b{font-size:24px;color:var(--st-text)}
.cp__feesub{font-size:12.5px;color:var(--st-text-muted);margin-top:8px;line-height:1.45}
.cp__fee em{font-size:13px;font-weight:500;color:var(--st-text-muted);font-style:normal;margin-left:8px}
.cp__table{width:100%;border-collapse:collapse;font-size:13px}
.cp__table th{text-align:right;font-weight:600;color:var(--st-text-muted);font-size:11px;text-transform:uppercase;letter-spacing:.03em;padding:6px 8px;border-bottom:1px solid var(--st-border)}
.cp__table th:first-child{text-align:left}
.cp__table td{text-align:right;padding:8px;border-bottom:1px solid color-mix(in srgb,var(--st-border) 60%,transparent);color:var(--st-text)}
.cp__table td:first-child{text-align:left}
.cp__empty{font-size:13px;color:var(--st-text-muted);padding:10px;border:1px dashed var(--st-border);border-radius:10px}
.cp__note{display:flex;align-items:flex-start;gap:7px;font-size:12px;color:var(--st-text-muted);line-height:1.45;margin-top:12px}
.cp__note svg{flex:none;margin-top:2px}
`
