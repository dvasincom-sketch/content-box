'use client'

import React from 'react'
import { HardDrive, Percent, Info, TrendingUp, Image as ImageIcon, Music, Images, FileDown, Video as VideoIcon } from 'lucide-react'
import { formatBytes, type MediaSourceStat } from '@/lib/mediaStats'
import { formatRub } from '@/lib/commerceStats'
import type { TariffResult } from '@/lib/tariff'
import { COMMISSION_RATE, STORAGE_RATE_RUB } from '@/lib/tariff'

/** Данные для раздела «Тариф» — считаются на сервере, панель только показывает. */
export interface TariffPanelData {
  tariff: TariffResult
  /** Разбивка занятого места по источникам (для наглядности). */
  sources: MediaSourceStat[]
  /** Выручка автора за месяц, ₽ (MRR активных платных подписок). */
  mrrRub: number
}

/** Дата в МСК без гидрационных рассинхронов (см. React #418). */
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' })
}

export function TariffPanel({ data }: { data: TariffPanelData | null }) {
  if (!data) {
    return (
      <section className="settings__block">
        <div className="settings__block-head">
          <h2>Тариф</h2>
          <p>Не удалось посчитать использование хранилища. Попробуйте обновить страницу.</p>
        </div>
      </section>
    )
  }

  const { tariff, sources, mrrRub } = data
  const commissionPct = Math.round(COMMISSION_RATE * 100)
  const usagePct = tariff.grade.ceilingGb > 0 ? Math.min(100, Math.round((tariff.usedGb / tariff.grade.ceilingGb) * 100)) : 0
  const feeFromStorage = tariff.storageFeeRub >= tariff.commissionFeeRub
  const nonEmpty = sources.filter((s) => s.files > 0 || s.bytes > 0)

  return (
    <>
      {/* ── Триал ─────────────────────────────────────────────────────────── */}
      {tariff.trialActive && (
        <section className="settings__block" style={bannerStyle}>
          <div className="settings__block-head" style={{ marginBottom: 4 }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Info size={18} /> Триал — {tariff.trialDaysLeft}&nbsp;{plural(tariff.trialDaysLeft, 'день', 'дня', 'дней')} осталось
            </h2>
            <p>
              Первые 30 дней хранилище до 15&nbsp;ГБ бесплатно, платформенный сбор — 0&nbsp;₽.
              Триал до {fmtDate(tariff.trialEndsAt)}.
            </p>
          </div>
        </section>
      )}

      {/* ── Занятое место + грейд ─────────────────────────────────────────── */}
      <section className="settings__block">
        <div className="settings__block-head">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HardDrive size={16} /> Хранилище
          </h2>
          <p>Сколько места занимает проект и как это соотносится с потолком грейда «{tariff.grade.label}».</p>
        </div>

        <div className="dash__stats dash__stats--2">
          <div className="dash__stat">
            <div className="dash__stat-value">{formatBytes(tariff.usedBytes)}</div>
            <div className="dash__stat-label">Занято ({tariff.usedGb} ГБ)</div>
          </div>
          <div className="dash__stat">
            <div className="dash__stat-value">{tariff.grade.ceilingGb} ГБ</div>
            <div className="dash__stat-label">Потолок грейда «{tariff.grade.label}»</div>
          </div>
        </div>

        {/* Прогресс к потолку */}
        <div style={{ marginTop: 14 }}>
          <div style={barTrackStyle}>
            <div style={{ ...barFillStyle, width: `${usagePct}%`, background: tariff.overCeiling ? '#dc2626' : usagePct > 80 ? '#f59e0b' : 'var(--accent, #7c3aed)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            <span>{usagePct}% потолка</span>
            {tariff.nextGrade
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><TrendingUp size={13} /> дальше: «{tariff.nextGrade.label}» — до {tariff.nextGrade.ceilingGb} ГБ</span>
              : <span>максимальный грейд</span>}
          </div>
        </div>

        {tariff.overCeiling && (
          <div className="settings__err" style={{ marginTop: 12 }}>
            Превышен потолок грейда «{tariff.grade.label}». Нужен апселл на «{tariff.nextGrade?.label ?? 'выше'}» или overage по ставке {STORAGE_RATE_RUB} ₽/ГБ.
          </div>
        )}

        {/* Разбивка по источникам */}
        {nonEmpty.length > 0 && (
          <div className="dash__mediabreak" style={{ marginTop: 14 }}>
            {nonEmpty.map((s) => (
              <div key={s.key} className="dash__mediabreak-row">
                <span className="dash__mediabreak-icon">{sourceIcon(s.key)}</span>
                <span className="dash__mediabreak-label">{s.label}</span>
                <span className="dash__mediabreak-count">{s.files} файл.</span>
                <span className="dash__mediabreak-size">{formatBytes(s.bytes)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Расчёт сбора ──────────────────────────────────────────────────── */}
      <section className="settings__block">
        <div className="settings__block-head">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Percent size={16} /> Платформенный сбор
          </h2>
          <p>
            Сбор за месяц = наибольшее из двух: {commissionPct}% от выручки или объём×{STORAGE_RATE_RUB} ₽/ГБ.
            Есть подписчики — платит комиссия, тарифа нет; нет — платит хранилище.
          </p>
        </div>

        <div className="dash__stats dash__stats--2">
          <div className="dash__stat" style={feeFromStorage && !tariff.trialActive ? pickedStyle : undefined}>
            <div className="dash__stat-value">{formatRub(tariff.storageFeeRub)}</div>
            <div className="dash__stat-label">Хранилище: {tariff.usedGb} ГБ × {STORAGE_RATE_RUB} ₽</div>
          </div>
          <div className="dash__stat" style={!feeFromStorage && !tariff.trialActive ? pickedStyle : undefined}>
            <div className="dash__stat-value">{formatRub(tariff.commissionFeeRub)}</div>
            <div className="dash__stat-label">{commissionPct}% от выручки {formatRub(mrrRub)}/мес</div>
          </div>
        </div>

        <div style={feeBoxStyle}>
          <span style={{ fontSize: 13, opacity: 0.75 }}>Расчётный сбор за месяц</span>
          <span style={{ fontSize: 26, fontWeight: 700 }}>
            {tariff.trialActive ? '0 ₽' : formatRub(tariff.feeRub)}
            {tariff.trialActive && <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.7, marginLeft: 8 }}>в триале</span>}
          </span>
        </div>
      </section>
    </>
  )
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

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few
  return many
}

const bannerStyle: React.CSSProperties = {
  borderColor: 'var(--accent, #7c3aed)',
  background: 'color-mix(in srgb, var(--accent, #7c3aed) 8%, transparent)',
}
const barTrackStyle: React.CSSProperties = {
  height: 10,
  borderRadius: 6,
  background: 'var(--surface-2, rgba(128,128,128,0.15))',
  overflow: 'hidden',
}
const barFillStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: 6,
  transition: 'width .3s ease',
}
const pickedStyle: React.CSSProperties = {
  outline: '2px solid var(--accent, #7c3aed)',
  outlineOffset: 2,
  borderRadius: 10,
}
const feeBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginTop: 14,
  padding: '14px 16px',
  borderRadius: 12,
  background: 'var(--surface-2, rgba(128,128,128,0.08))',
}
