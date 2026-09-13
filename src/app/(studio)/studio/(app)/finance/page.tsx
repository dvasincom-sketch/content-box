import React from 'react'
import { redirect } from 'next/navigation'
import { Wallet } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { requireAuthor } from '@/lib/currentAuthor'
import { getPlatformFinance } from '@/lib/platformFinance'
import { formatRub } from '@/lib/commerceStats'
import { SMS_COST_RUB } from '@/lib/smsLog'

/**
 * Владельческая сводка «Финансы» по всем авторам. Только для superadmin
 * (платформенный администратор). Доход (подписки + донаты) минус расход
 * (SMS + почтовый сервер). Заголовок — за 30 дней (сопоставимо с почтой
 * 1000 ₽/мес), в таблице — по каждому тенанту (30 дней и за всё время).
 */
export const dynamic = 'force-dynamic'

/** formatRub отдаёт «0 ₽» для ≤0 — для «Чистыми» нужен знак минуса. */
function fmtNet(n: number): string {
  if (n < 0) return '−' + formatRub(-n)
  return formatRub(n)
}

const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '10px 12px', whiteSpace: 'nowrap' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }

export default async function FinancePage() {
  const author = await requireAuthor()
  if (!author.isSuperadmin) redirect('/studio')

  const payload = await getPayload({ config: await config })
  const fin = await getPlatformFinance(payload)
  const t = fin.totals

  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1><Wallet size={22} style={{ verticalAlign: '-4px', marginRight: 8 }} />Финансы</h1>
          <div className="studio-page-head__sub">Сводка по всем авторам · платформенный доступ</div>
        </div>
      </div>

      {/* Итоги за 30 дней */}
      <div className="dash__kpis" style={{ marginBottom: 8 }}>
        <div className="dash__kpi">
          <div className="dash__kpi-body">
            <div className="dash__kpi-value" style={{ color: '#16a34a' }}>{formatRub(t.income30d)}</div>
            <div className="dash__kpi-label">Доход · 30 дней</div>
          </div>
        </div>
        <div className="dash__kpi">
          <div className="dash__kpi-body">
            <div className="dash__kpi-value" style={{ color: '#dc2626' }}>{formatRub(t.expense30d)}</div>
            <div className="dash__kpi-label">Расход · 30 дней</div>
          </div>
        </div>
        <div className="dash__kpi">
          <div className="dash__kpi-body">
            <div className="dash__kpi-value" style={{ color: t.net30d >= 0 ? '#16a34a' : '#dc2626' }}>{fmtNet(t.net30d)}</div>
            <div className="dash__kpi-label">Чистыми · 30 дней</div>
          </div>
        </div>
      </div>

      {/* Расшифровка доходов/расходов за 30 дней */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '0 0 24px' }}>
        <div style={{ flex: '1 1 280px', border: '1px solid color-mix(in srgb, var(--st-text) 10%, transparent)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Доход за 30 дней</div>
          <Line label="Подписки" value={formatRub(t.subs30d)} />
          <Line label="Донаты" value={formatRub(t.donations30d)} />
          <Line label="Итого" value={formatRub(t.income30d)} bold />
        </div>
        <div style={{ flex: '1 1 280px', border: '1px solid color-mix(in srgb, var(--st-text) 10%, transparent)', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Расход за 30 дней</div>
          <Line label={`SMS · ${t.smsSent30d} шт. × ${SMS_COST_RUB} ₽`} value={formatRub(t.smsCost30d)} />
          <Line label="Почтовый сервер (фикс.)" value={`${formatRub(fin.emailMonthly)}/мес`} />
          <Line label="Итого" value={formatRub(t.expense30d)} bold />
        </div>
      </div>

      {/* Разбивка по авторам */}
      <div style={{ overflowX: 'auto', border: '1px solid color-mix(in srgb, var(--st-text) 10%, transparent)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ color: 'var(--st-text-muted)', background: 'color-mix(in srgb, var(--st-text) 4%, transparent)' }}>
              <th style={th}>Автор</th>
              <th style={thR}>Подписки 30д</th>
              <th style={thR}>Донаты 30д</th>
              <th style={thR}>SMS 30д</th>
              <th style={thR}>SMS ₽ 30д</th>
              <th style={thR}>Доход всего</th>
            </tr>
          </thead>
          <tbody>
            {fin.rows.map((r) => (
              <tr key={r.tenantId == null ? 'null' : r.tenantId} style={{ borderTop: '1px solid color-mix(in srgb, var(--st-text) 8%, transparent)' }}>
                <td style={td}>{r.name}</td>
                <td style={tdR}>{formatRub(r.subs30d)}</td>
                <td style={tdR}>{formatRub(r.donations30d)}</td>
                <td style={tdR}>{r.smsSent30d}</td>
                <td style={tdR}>{formatRub(r.smsCost30d)}</td>
                <td style={{ ...tdR, color: 'var(--st-text-muted)' }}>{formatRub(r.subsTotal + r.donationsTotal)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid color-mix(in srgb, var(--st-text) 20%, transparent)', fontWeight: 700 }}>
              <td style={td}>Итого</td>
              <td style={tdR}>{formatRub(t.subs30d)}</td>
              <td style={tdR}>{formatRub(t.donations30d)}</td>
              <td style={tdR}>{t.smsSent30d}</td>
              <td style={tdR}>{formatRub(t.smsCost30d)}</td>
              <td style={tdR}>{formatRub(t.subsTotal + t.donationsTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 14, fontSize: 13, color: 'var(--st-text-muted)', lineHeight: 1.5 }}>
        Доходы считаются по успешно оплаченным подпискам и донатам. SMS учитываются с момента запуска журнала —
        отправки до этого в статистику не попадают. Почтовый сервер — общий фиксированный расход платформы
        ({formatRub(fin.emailMonthly)}/мес), между авторами не делится. Строка «Без тенанта» — SMS входа авторов
        в студию (не привязаны к конкретному проекту).
      </p>
    </>
  )
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', fontWeight: bold ? 700 : 400, borderTop: bold ? '1px solid color-mix(in srgb, var(--st-text) 12%, transparent)' : undefined, marginTop: bold ? 4 : 0, paddingTop: bold ? 8 : 4 }}>
      <span style={{ color: bold ? 'var(--st-text)' : 'var(--st-text-muted)' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}
