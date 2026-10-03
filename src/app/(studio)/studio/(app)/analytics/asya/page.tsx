import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { MessageCircle, ThumbsUp, ThumbsDown, HelpCircle, Search as SearchIcon } from 'lucide-react'
import { requireAuthor } from '@/lib/currentAuthor'
import { getAsyaFeedbackStats, type AsyaFilter } from '@/lib/asyaFeedbackStats'
import { publicSubscriberName } from '@/lib/phone'

/**
 * Студия → Аналитика → Ася (owner-only). Обратная связь по ассистенту:
 * сколько вопросов, у скольких нашлись видео, оценки 👍/👎, и лента реальных
 * диалогов с фильтрами (все / дизлайки / без видео). Помогает увидеть спрос и
 * пробелы знания Аси.
 */
export const dynamic = 'force-dynamic'

const fmtDate = (v: string): string => {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(d)
  } catch { return '' }
}

export default async function AsyaAnalytics({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const author = await requireAuthor()
  const isOwner = (author!.user as { tenantRole?: string | null }).tenantRole !== 'contributor'
  if (!isOwner) redirect('/studio')

  const sp = await searchParams
  const fParam = String(sp?.f || '')
  const filter: AsyaFilter = fParam === 'down' ? 'down' : fParam === 'nomatch' ? 'nomatch' : 'all'

  const payload = await getPayload({ config: await config })
  const stats = await getAsyaFeedbackStats(payload, author!.tenantId, filter)
  const hasAny = !!stats && stats.total > 0

  const matchPct = stats && stats.total > 0 ? Math.round((stats.withMatches / stats.total) * 100) : 0
  const KPI = [
    { label: 'Вопросов всего', value: stats?.total ?? 0, icon: <MessageCircle size={16} /> },
    { label: 'Нашлись видео', value: `${matchPct}%`, icon: <SearchIcon size={16} /> },
    { label: 'Без ответа (нет видео)', value: stats?.noMatches ?? 0, icon: <HelpCircle size={16} /> },
    { label: '👍 Помогло', value: stats?.up ?? 0, icon: <ThumbsUp size={16} /> },
    { label: '👎 Не помогло', value: stats?.down ?? 0, icon: <ThumbsDown size={16} /> },
  ]

  const tab = (f: AsyaFilter, label: string, count?: number) => (
    <Link
      href={f === 'all' ? '/studio/analytics/asya' : `/studio/analytics/asya?f=${f}`}
      className={`settings__tab${filter === f ? ' is-active' : ''}`}
      style={{ textDecoration: 'none' }}
    >
      {label}{typeof count === 'number' ? ` (${count})` : ''}
    </Link>
  )

  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Ася</h1>
          <div className="studio-page-head__sub">Что спрашивают у ассистента и как он отвечает</div>
          <div className="settings__tabs" style={{ marginTop: '.7rem', marginBottom: 0 }}>
            <Link href="/studio/analytics" className="settings__tab" style={{ textDecoration: 'none' }}>Посещаемость</Link>
            <Link href="/studio/analytics/newsletters" className="settings__tab" style={{ textDecoration: 'none' }}>Рассылки</Link>
            <Link href="/studio/analytics/videos" className="settings__tab" style={{ textDecoration: 'none' }}>Видео</Link>
            <Link href="/studio/analytics/search" className="settings__tab" style={{ textDecoration: 'none' }}>Поиск</Link>
            <Link href="/studio/analytics/asya" className="settings__tab is-active" style={{ textDecoration: 'none' }}>Ася</Link>
            <Link href="/studio/analytics/team" className="settings__tab" style={{ textDecoration: 'none' }}>Команда</Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900 }}>
        {!hasAny ? (
          <div className="studio-card" style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--st-text-muted)' }}>
            <MessageCircle size={26} style={{ opacity: 0.5, marginBottom: 8 }} />
            <div style={{ fontWeight: 600, color: 'var(--st-text)', marginBottom: 4 }}>Пока нет вопросов к Асе</div>
            <div style={{ fontSize: 14 }}>Диалоги появятся здесь, как только подписчики начнут спрашивать Асю на сайте.</div>
          </div>
        ) : (
          <>
            <section className="studio-card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
                {KPI.map((k) => (
                  <div key={k.label} style={{ padding: '4px 2px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{k.icon}{k.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{k.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--st-text-muted)', lineHeight: 1.5 }}>
                «Без ответа» — вопросы, к которым Ася не нашла ни одного видео: прямая подсказка, какого контента или знания не хватает. Оценки 👍/👎 ставят сами подписчики под ответом.
              </div>
            </section>

            <div className="settings__tabs" style={{ marginBottom: 12 }}>
              {tab('all', 'Все', stats!.total)}
              {tab('nomatch', 'Без видео', stats!.noMatches)}
              {tab('down', 'Дизлайки', stats!.down)}
            </div>

            <section className="studio-card">
              {stats!.rows.length === 0 ? (
                <div style={{ padding: 16, color: 'var(--st-text-muted)', fontSize: 14 }}>В этом фильтре пусто.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {stats!.rows.map((r) => (
                    <div key={r.id} style={{ borderBottom: '1px solid var(--st-border)', paddingBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--st-text-muted)' }}>{fmtDate(r.createdAt)}</span>
                        <span style={{ fontSize: 12, color: 'var(--st-text-muted)' }}>· {publicSubscriberName(r.sub, 'Подписчик')}</span>
                        {!r.hadMatches && <span style={{ fontSize: 11, fontWeight: 700, color: '#b7791f', background: 'color-mix(in srgb, #f59e0b 16%, transparent)', borderRadius: 999, padding: '2px 8px' }}>нет видео</span>}
                        {r.rating === 'up' && <span style={{ fontSize: 12 }}>👍</span>}
                        {r.rating === 'down' && <span style={{ fontSize: 12 }}>👎</span>}
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--st-text)', marginBottom: 4 }}>{r.question}</div>
                      <div style={{ fontSize: 14, color: 'var(--st-text-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.answer}</div>
                      {r.matches.filter((m) => m.url).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {r.matches.filter((m) => m.url).slice(0, 4).map((m, k) => (
                            <a key={k} href={m.url as string} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: 'var(--st-text)', textDecoration: 'none', border: '1px solid var(--st-border)', borderRadius: 8, padding: '4px 8px' }}>▶ {m.title || 'видео'}</a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  )
}
