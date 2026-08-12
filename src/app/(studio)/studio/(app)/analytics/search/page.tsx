import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { Search, TrendingUp, Clock } from 'lucide-react'
import { requireAuthor } from '@/lib/currentAuthor'
import { getSearchStats } from '@/lib/searchStats'

/**
 * Аналитика → «Поиск»: агрегированный лог поисковых запросов сайта —
 * популярные (топ по частоте за период) и недавние. Только владелец проекта.
 */
export const dynamic = 'force-dynamic'

const RANGES = [7, 30, 90] as const
type Range = (typeof RANGES)[number]
function parseRange(v: string | string[] | undefined): Range {
  const n = Number(Array.isArray(v) ? v[0] : v)
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : 30
}

export default async function StudioSearchAnalytics({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const author = await requireAuthor()
  const isOwner = (author!.user as { tenantRole?: string | null }).tenantRole !== 'contributor'
  if (!isOwner) redirect('/studio')

  const range = parseRange((await searchParams).range)
  const payload = await getPayload({ config: await config })
  const stats = await getSearchStats(payload, author!.tenantId as number, range)
  const maxCount = Math.max(1, ...stats.popular.map((p) => p.count))

  const head = (
    <div className="studio-page-head">
      <div>
        <h1>Аналитика</h1>
        <div className="studio-page-head__sub">Что ищут на сайте — популярные и недавние запросы</div>
        <div className="settings__tabs" style={{ marginTop: '.7rem', marginBottom: 0 }}>
          <Link href="/studio/analytics" className="settings__tab" style={{ textDecoration: 'none' }}>Посещаемость</Link>
          <Link href="/studio/analytics/newsletters" className="settings__tab" style={{ textDecoration: 'none' }}>Рассылки</Link>
          <Link href="/studio/analytics/videos" className="settings__tab" style={{ textDecoration: 'none' }}>Видео</Link>
          <Link href="/studio/analytics/search" className="settings__tab is-active" style={{ textDecoration: 'none' }}>Поиск</Link>
          <Link href="/studio/analytics/team" className="settings__tab" style={{ textDecoration: 'none' }}>Команда</Link>
        </div>
      </div>
      <div className="an__ranges" role="tablist" aria-label="Период">
        {RANGES.map((r) => (
          <Link key={r} href={`/studio/analytics/search?range=${r}`} role="tab" aria-selected={range === r} className={'an__range' + (range === r ? ' is-active' : '')}>{r} дн.</Link>
        ))}
      </div>
    </div>
  )

  const noData = stats.total === 0 && stats.recent.length === 0

  return (
    <>
      {head}

      <div className="dash__kpis">
        <div className="dash__kpi">
          <div className="dash__kpi-icon"><Search size={16} /></div>
          <div className="dash__kpi-body">
            <div className="dash__kpi-value">{stats.total.toLocaleString('ru-RU')}</div>
            <div className="dash__kpi-label">Запросов за {range} дн.</div>
          </div>
        </div>
        <div className="dash__kpi">
          <div className="dash__kpi-icon"><TrendingUp size={16} /></div>
          <div className="dash__kpi-body">
            <div className="dash__kpi-value">{stats.uniq.toLocaleString('ru-RU')}</div>
            <div className="dash__kpi-label">Уникальных запросов</div>
          </div>
        </div>
      </div>

      {noData ? (
        <div className="studio-card an__notice">
          <div className="an__notice-icon"><Search size={18} /></div>
          <div>
            <div className="an__notice-title">Пока нет данных о поиске</div>
            <p className="an__notice-text">Как только посетители начнут искать по сайту, здесь появятся самые частые и последние запросы.</p>
          </div>
        </div>
      ) : (
        <div className="an__grid">
          <section className="studio-card an__list">
            <div className="an__list-head"><TrendingUp size={16} /> Популярные запросы</div>
            {stats.popular.length === 0 ? (
              <div className="an__empty an__empty--sm">Нет данных за период</div>
            ) : (
              <ul className="an__rows">
                {stats.popular.map((it, i) => (
                  <li key={i} className="an__row" title={it.q}>
                    <span className="an__row-bar" style={{ width: `${(it.count / maxCount) * 100}%` }} aria-hidden />
                    <span className="an__row-label">{it.q}</span>
                    <span className="an__row-count">{it.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="studio-card an__list">
            <div className="an__list-head"><Clock size={16} /> Недавние запросы</div>
            {stats.recent.length === 0 ? (
              <div className="an__empty an__empty--sm">Нет недавних запросов</div>
            ) : (
              <ul className="an__rows">
                {stats.recent.map((q, i) => (
                  <li key={i} className="an__row" title={q}>
                    <span className="an__row-label">{q}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  )
}
