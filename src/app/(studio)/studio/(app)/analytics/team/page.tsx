import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { Users, FileText, Layers, Clock, CalendarDays } from 'lucide-react'
import { requireAuthor } from '@/lib/currentAuthor'
import { getTeamStats } from '@/lib/teamStats'

/**
 * Студия → Аналитика → Команда (owner-only). Агрегаты по участникам студии:
 * время на сайте по дням (оценка по журналу активности), сколько материалов
 * добавили и среднее время на публикацию.
 */
export const dynamic = 'force-dynamic'

const RANGES = [7, 30, 90] as const
function parseRange(v: string | string[] | undefined): number {
  const n = Number(Array.isArray(v) ? v[0] : v)
  return (RANGES as readonly number[]).includes(n) ? n : 30
}

function fmtMin(min: number): string {
  if (min <= 0) return '—'
  if (min < 60) return `${min} м`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} ч ${m} м` : `${h} ч`
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: 'short' }) } catch { return '—' }
}
// Последние N дней (ключи YYYY-MM-DD в МСК) — ось для спарклайна.
function lastDays(n: number): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    out.push(d.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' }))
  }
  return out
}

export default async function TeamAnalytics({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const author = await requireAuthor()
  const isOwner = (author!.user as { tenantRole?: string | null }).tenantRole !== 'contributor'
  if (!isOwner) redirect('/studio')

  const sp = await searchParams
  const range = parseRange(sp?.range)
  const payload = await getPayload({ config: await config })
  const stats = await getTeamStats(payload, author!.tenantId, range)

  const members = stats?.members ?? []
  const axis = lastDays(14)
  const totals = {
    people: members.length,
    active: members.filter((m) => m.activeDays > 0).length,
    pubs: members.reduce((a, m) => a + m.pubs, 0),
    materials: members.reduce((a, m) => a + m.materials, 0),
    minutes: members.reduce((a, m) => a + m.activeMinutes, 0),
  }
  const maxDay = Math.max(30, ...members.flatMap((m) => m.daily.map((d) => d.minutes)))

  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Команда</h1>
          <div className="studio-page-head__sub">Активность и продуктивность участников студии</div>
          <div className="settings__tabs" style={{ marginTop: '.7rem', marginBottom: 0 }}>
            <Link href="/studio/analytics" className="settings__tab" style={{ textDecoration: 'none' }}>Посещаемость</Link>
            <Link href="/studio/analytics/newsletters" className="settings__tab" style={{ textDecoration: 'none' }}>Рассылки</Link>
            <Link href="/studio/analytics/videos" className="settings__tab" style={{ textDecoration: 'none' }}>Видео</Link>
            <Link href="/studio/analytics/search" className="settings__tab" style={{ textDecoration: 'none' }}>Поиск</Link>
            <Link href="/studio/analytics/team" className="settings__tab is-active" style={{ textDecoration: 'none' }}>Команда</Link>
          </div>
        </div>
        <div className="an__ranges" role="tablist" aria-label="Период">
          {RANGES.map((r) => (
            <Link key={r} href={`/studio/analytics/team?range=${r}`} role="tab" aria-selected={range === r} className={'an__range' + (range === r ? ' is-active' : '')}>{r} дн.</Link>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 980 }}>
        {members.length === 0 ? (
          <div className="studio-card" style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--st-text-muted)' }}>
            <Users size={26} style={{ opacity: 0.5, marginBottom: 8 }} />
            <div style={{ fontWeight: 600, color: 'var(--st-text)', marginBottom: 4 }}>Пока нет данных по команде</div>
            <div style={{ fontSize: 14 }}>Добавьте участников в разделе «Доступ» — здесь появится их активность и продуктивность.</div>
          </div>
        ) : (
          <>
            <section className="studio-card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14 }}>
                {[
                  { icon: <Users size={16} />, label: 'Участников', val: String(totals.people) },
                  { icon: <CalendarDays size={16} />, label: 'Активны в периоде', val: String(totals.active) },
                  { icon: <FileText size={16} />, label: 'Публикаций', val: String(totals.pubs) },
                  { icon: <Layers size={16} />, label: 'Материалов', val: String(totals.materials) },
                  { icon: <Clock size={16} />, label: 'Время команды', val: fmtMin(totals.minutes) },
                ].map((k) => (
                  <div key={k.label} style={{ padding: '4px 2px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{k.icon}{k.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{k.val}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="studio-card">
              <div className="an__list-head"><Users size={16} /> По участникам</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--st-text-muted)', fontSize: 12.5 }}>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Участник</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600 }}>Активность по дням</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Дней</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Время</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Публик.</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Материалов</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Ср./публ.</th>
                      <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Был(а)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => {
                      const byDay = new Map(m.daily.map((d) => [d.day, d.minutes]))
                      return (
                        <tr key={m.userId} style={{ borderTop: '1px solid var(--st-border)', opacity: m.disabled ? 0.55 : 1 }}>
                          <td style={{ padding: '9px 10px' }}>
                            <div style={{ fontWeight: 600 }}>{m.name}{m.disabled ? ' · отключён' : ''}</div>
                            <div style={{ fontSize: 12, color: 'var(--st-text-muted)' }}>{m.role}</div>
                          </td>
                          <td style={{ padding: '9px 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 30 }} title="Минуты активности по дням (14 дней)">
                              {axis.map((day) => {
                                const min = byDay.get(day) || 0
                                const h = min > 0 ? Math.max(3, Math.round((min / maxDay) * 28)) : 2
                                return <span key={day} title={`${day}: ${min} м`} style={{ width: 6, height: h, borderRadius: 2, background: min > 0 ? 'var(--st-accent)' : 'var(--st-surface-2, rgba(128,128,128,.2))' }} />
                              })}
                            </div>
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'right' }}>{m.activeDays}</td>
                          <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmtMin(m.activeMinutes)}</td>
                          <td style={{ padding: '9px 10px', textAlign: 'right' }}>{m.pubs}</td>
                          <td style={{ padding: '9px 10px', textAlign: 'right' }}>{m.materials}</td>
                          <td style={{ padding: '9px 10px', textAlign: 'right' }}>{m.avgPerPubMin != null ? fmtMin(m.avgPerPubMin) : '—'}</td>
                          <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmtDate(m.lastActive)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--st-text-muted)', lineHeight: 1.5 }}>
                «Время» — оценка по журналу активности студии (промежутки между действиями внутри дня, каждый не больше 30 минут). «Материалов» — все созданные объекты (публикации, видео, книги, файлы). «Ср./публ.» — активное время, делённое на число созданных публикаций. Столбики — минуты активности по дням за 2 недели.
              </div>
            </section>
          </>
        )}
      </div>
    </>
  )
}
