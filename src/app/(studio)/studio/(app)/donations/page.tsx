import React from 'react'
import { redirect } from 'next/navigation'
import { HandCoins } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { requireAuthor } from '@/lib/currentAuthor'
import { getDonationStats } from '@/lib/donationStats'
import { formatRub } from '@/lib/commerceStats'

/**
 * Страница «Донаты» студии: список платежей поддержки (support-payments) тенанта
 * + итоги. Раньше донаты были видны только в «сыром» админе Payload — автор их
 * в студии не видел. Финансовое — только владельцу (не contributor).
 */
export const dynamic = 'force-dynamic'

type Row = {
  id: number | string
  displayName?: string | null
  amountRub?: number | null
  message?: string | null
  isAnonymous?: boolean | null
  status?: string | null
  createdAt?: string | null
  goal?: unknown
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function goalTitle(goal: unknown): string | null {
  if (goal && typeof goal === 'object') {
    const g = goal as { title?: string; name?: string }
    return g.title || g.name || null
  }
  return null
}

const STATUS: Record<string, { label: string; color: string }> = {
  succeeded: { label: 'Успешно', color: '#16a34a' },
  pending: { label: 'Ожидает', color: '#e0821a' },
  canceled: { label: 'Отменён', color: '#dc2626' },
}

export default async function DonationsPage() {
  const author = await requireAuthor()
  const isOwner = (author.user as { tenantRole?: string | null }).tenantRole !== 'contributor'
  if (!isOwner) redirect('/studio')

  const payload = await getPayload({ config: await config })
  const tenantId = author.tenantId

  const [stats, listRes] = await Promise.all([
    getDonationStats(payload, tenantId),
    payload
      .find({
        collection: 'support-payments',
        where: { tenant: { equals: tenantId } },
        sort: '-createdAt',
        limit: 300,
        depth: 1,
        overrideAccess: true,
      })
      .catch(() => ({ docs: [] as Row[] })),
  ])
  const rows = (listRes.docs as Row[]) || []

  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1><HandCoins size={22} style={{ verticalAlign: '-4px', marginRight: 8 }} />Донаты</h1>
          <div className="studio-page-head__sub">Платежи со страницы «Поддержать проект»</div>
        </div>
      </div>

      <div className="dash__stats dash__stats--2" style={{ marginBottom: 20 }}>
        <div className="dash__stat">
          <div className="dash__stat-value">{formatRub(stats.sum30d)}</div>
          <div className="dash__stat-label">За 30 дней · {stats.count30d} шт.</div>
        </div>
        <div className="dash__stat">
          <div className="dash__stat-value">{formatRub(stats.total)}</div>
          <div className="dash__stat-label">Всего · {stats.count} шт.</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--st-text-muted)', border: '1px dashed color-mix(in srgb, var(--st-text) 18%, transparent)', borderRadius: 12 }}>
          Донатов пока нет. Они появятся здесь после первой поддержки на странице «Поддержать проект».
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid color-mix(in srgb, var(--st-text) 10%, transparent)', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--st-text-muted)', background: 'color-mix(in srgb, var(--st-text) 4%, transparent)' }}>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Дата</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Имя</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Сумма</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Сообщение</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Цель</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = STATUS[String(r.status || '')] || { label: String(r.status || '—'), color: 'var(--st-text-muted)' }
                const name = r.isAnonymous ? 'Аноним' : (r.displayName || '—')
                const goal = goalTitle(r.goal)
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid color-mix(in srgb, var(--st-text) 8%, transparent)' }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--st-text-muted)' }}>{fmtDateTime(r.createdAt)}</td>
                    <td style={{ padding: '10px 12px' }}>{name}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{formatRub(Number(r.amountRub) || 0)}</td>
                    <td style={{ padding: '10px 12px', maxWidth: 320, color: 'var(--st-text-muted)' }}>{r.message || '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--st-text-muted)' }}>{goal || '—'}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.color, display: 'inline-block' }} />
                        {st.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: 14, fontSize: 13, color: 'var(--st-text-muted)' }}>
        В суммы «За 30 дней» и «Всего» входят только успешно оплаченные донаты (status «Успешно»).
      </p>
    </>
  )
}
