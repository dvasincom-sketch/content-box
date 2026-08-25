'use client'

import React, { useEffect, useState } from 'react'
import { Loader2, Receipt } from 'lucide-react'

/**
 * История платежей подписок для вкладки «Платежи»: сводка (успешных, сумма) и
 * таблица последних платежей. Данные — GET /studio/api/settings/payments.
 */

type Item = {
  id: number | string
  subscriberName: string
  tierName: string
  amountRub: number
  status: string
  isRecurring: boolean
  yookassaPaymentId: string | null
  date: string | null
}

type Summary = { succeededCount: number; sumRub: number; capped: boolean }

const STATUS_LABEL: Record<string, string> = {
  succeeded: 'Оплачен',
  pending: 'Ожидает',
  canceled: 'Отменён',
  refunded: 'Возврат',
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' })
}

function fmtRub(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₽'
}

export function PaymentsHistoryPanel() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/studio/api/settings/payments', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return
        if (j?.error) setError(j.error)
        else {
          setSummary(j.summary ?? null)
          setItems(Array.isArray(j.items) ? j.items : [])
        }
      })
      .catch(() => alive && setError('Не удалось загрузить платежи'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  return (
    <section className="settings__block">
      <div className="settings__block-head">
        <h2><Receipt size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />Платежи подписок</h2>
        <p>Сводка и последние платежи через ЮKassa. Обновляется по мере поступления оплат.</p>
      </div>

      {loading ? (
        <div className="an__empty"><Loader2 size={15} className="spin" /> Загрузка…</div>
      ) : error ? (
        <div className="settings__err">{error}</div>
      ) : (
        <>
          {summary && (
            <div className="paymt__summary">
              <div className="paymt__stat">
                <div className="paymt__stat-val">{summary.succeededCount}</div>
                <div className="paymt__stat-label">Успешных платежей{summary.capped ? '+' : ''}</div>
              </div>
              <div className="paymt__stat">
                <div className="paymt__stat-val">{fmtRub(summary.sumRub)}</div>
                <div className="paymt__stat-label">Сумма поступлений{summary.capped ? ' (последние 1000)' : ''}</div>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <p className="settings__hint" style={{ marginTop: 12 }}>Платежей пока нет. Они появятся здесь после первой оплаты подписки через ЮKassa.</p>
          ) : (
            <div className="paymt__table-wrap">
              <table className="paymt__table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Подписчик</th>
                    <th>Уровень</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id}>
                      <td>{fmtDate(p.date)}</td>
                      <td>{p.subscriberName}</td>
                      <td>{p.tierName}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {fmtRub(p.amountRub)}
                        {p.isRecurring && <span className="paymt__auto" title="Автосписание">авто</span>}
                      </td>
                      <td>
                        <span className={`paymt__status paymt__status--${p.status}`}>
                          {STATUS_LABEL[p.status] || p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
