import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { Film, Users, Play, Timer, Gauge, Flag } from 'lucide-react'
import { requireAuthor } from '@/lib/currentAuthor'
import { getVideoAggStats } from '@/lib/videoAggStats'

/**
 * Студия → Аналитика → Видео (owner-only, read-only).
 * Агрегированная статистика по всем видео тенанта: зрители, проигрывания,
 * средний досмотр и удержание (до середины / до конца) + разбивка по видео.
 * Те же метрики, что в карточке одного видео, но по всей библиотеке.
 */
export const dynamic = 'force-dynamic'

const KPI: { key: 'totalVideos' | 'viewers' | 'starts' | 'avgWatch' | 'mid' | 'end'; label: string; icon: React.ReactNode; suffix?: string }[] = [
  { key: 'totalVideos', label: 'Видео', icon: <Film size={16} /> },
  { key: 'viewers', label: 'Зрителей', icon: <Users size={16} /> },
  { key: 'starts', label: 'Проигрываний', icon: <Play size={16} /> },
  { key: 'avgWatch', label: 'Ср. досмотр', icon: <Gauge size={16} />, suffix: '%' },
  { key: 'mid', label: 'До середины', icon: <Timer size={16} />, suffix: '%' },
  { key: 'end', label: 'До конца', icon: <Flag size={16} />, suffix: '%' },
]

export default async function VideosAnalytics() {
  const author = await requireAuthor()
  const isOwner = (author!.user as { tenantRole?: string | null }).tenantRole !== 'contributor'
  if (!isOwner) redirect('/studio')

  const payload = await getPayload({ config: await config })
  const stats = await getVideoAggStats(payload, author!.tenantId)
  const hasData = !!stats && (stats.starts > 0 || stats.viewers > 0)

  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Видео</h1>
          <div className="studio-page-head__sub">Просмотры и удержание по всем видео проекта</div>
          <div className="settings__tabs" style={{ marginTop: '.7rem', marginBottom: 0 }}>
            <Link href="/studio/analytics" className="settings__tab" style={{ textDecoration: 'none' }}>Посещаемость</Link>
            <Link href="/studio/analytics/newsletters" className="settings__tab" style={{ textDecoration: 'none' }}>Рассылки</Link>
            <Link href="/studio/analytics/videos" className="settings__tab is-active" style={{ textDecoration: 'none' }}>Видео</Link>
            <Link href="/studio/analytics/team" className="settings__tab" style={{ textDecoration: 'none' }}>Команда</Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900 }}>
        {!hasData ? (
          <div className="studio-card" style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--st-text-muted)' }}>
            <Film size={26} style={{ opacity: 0.5, marginBottom: 8 }} />
            <div style={{ fontWeight: 600, color: 'var(--st-text)', marginBottom: 4 }}>Пока нет данных о просмотрах</div>
            <div style={{ fontSize: 14 }}>Статистика появится, как только зрители начнут смотреть ваши видео.</div>
          </div>
        ) : (
          <>
            <section className="studio-card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14 }}>
                {KPI.map((k) => (
                  <div key={k.key} style={{ padding: '4px 2px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                      {k.icon}
                      {k.label}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>
                      {stats![k.key]}
                      {k.suffix || ''}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--st-text-muted)', lineHeight: 1.5 }}>
                «Проигрываний» — сколько раз запускали видео (с повторами). «Ср. досмотр», «до середины» и «до конца» — какая доля запусков досмотрела до этой точки.
              </div>
            </section>

            {stats!.rows.length > 0 && (
              <section className="studio-card">
                <div className="an__list-head"><Film size={16} /> По видео</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--st-text-muted)', fontSize: 12.5 }}>
                        <th style={{ padding: '8px 10px', fontWeight: 600 }}>Видео</th>
                        <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Зрителей</th>
                        <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Проигр.</th>
                        <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Ср. досмотр</th>
                        <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>До конца</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats!.rows.map((r) => (
                        <tr key={r.id} style={{ borderTop: '1px solid var(--st-border)' }}>
                          <td style={{ padding: '9px 10px', maxWidth: 320 }}>
                            <Link href={`/studio/videos/${r.id}`} style={{ color: 'var(--st-text)', textDecoration: 'none', fontWeight: 500 }}>
                              {r.title}
                            </Link>
                          </td>
                          <td style={{ padding: '9px 10px', textAlign: 'right' }}>{r.viewers}</td>
                          <td style={{ padding: '9px 10px', textAlign: 'right' }}>{r.starts}</td>
                          <td style={{ padding: '9px 10px', textAlign: 'right' }}>{r.avgWatch}%</td>
                          <td style={{ padding: '9px 10px', textAlign: 'right' }}>{r.end}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  )
}
