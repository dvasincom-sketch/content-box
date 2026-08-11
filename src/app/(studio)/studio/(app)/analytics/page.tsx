import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { Eye, Users, Timer, LogOut, FileText, Link2, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react'
import { requireAuthor } from '@/lib/currentAuthor'
import { umamiApiEnabled, umamiTrackingEnabled } from '@/lib/umami'
import { getUmamiStats, formatDuration, deltaPct, type UmamiKpi, type UmamiMetric } from '@/lib/umamiStats'
import { UmamiChart } from './UmamiChart'
import type { Tenant } from '@/payload-types'

/**
 * Студийный раздел «Аналитика» (веб-трафик из self-hosted Umami).
 * Только владелец проекта. Данные тянем по tenant.umamiWebsiteId. Пока Umami
 * не подключён платформой (env) или website не задан — показываем заглушку.
 */

export const dynamic = 'force-dynamic'

const RANGES = [7, 30, 90] as const
type Range = (typeof RANGES)[number]

function parseRange(v: string | string[] | undefined): Range {
  const n = Number(Array.isArray(v) ? v[0] : v)
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : 30
}

function Delta({ k }: { k: UmamiKpi }) {
  const d = deltaPct(k)
  if (d === null || d === 0) return null
  const up = d > 0
  return (
    <span className={`dash__kpi-delta ${up ? 'is-up' : 'is-down'}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(d)}%
    </span>
  )
}

function MetricList({ title, icon, items, kind }: { title: string; icon: React.ReactNode; items: UmamiMetric[]; kind: 'page' | 'ref' }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <section className="studio-card an__list">
      <div className="an__list-head">{icon} {title}</div>
      {items.length === 0 ? (
        <div className="an__empty an__empty--sm">Нет данных за период</div>
      ) : (
        <ul className="an__rows">
          {items.map((it, i) => (
            <li key={i} className="an__row" title={it.label}>
              <span className="an__row-bar" style={{ width: `${(it.count / max) * 100}%` }} aria-hidden />
              <span className="an__row-label">{kind === 'ref' && it.label !== '(прямой)' ? cleanRef(it.label) : it.label}</span>
              <span className="an__row-count">{it.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function cleanRef(r: string): string {
  return r.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="studio-card an__notice">
      <div className="an__notice-icon"><Info size={18} /></div>
      <div>
        <div className="an__notice-title">{title}</div>
        <p className="an__notice-text">{children}</p>
      </div>
    </div>
  )
}

export default async function StudioAnalytics({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const author = await requireAuthor()

  // Раздел — только для владельца проекта (не contributor, не участник).
  const isOwner = (author!.user as { tenantRole?: string | null }).tenantRole !== 'contributor'
  if (!isOwner) redirect('/studio')

  const range = parseRange((await searchParams).range)

  const payload = await getPayload({ config: await config })
  const tenant = (await payload
    .findByID({ collection: 'tenants', id: author!.tenantId, depth: 0, overrideAccess: true })
    .catch(() => null)) as Tenant | null
  const websiteId = (tenant?.umamiWebsiteId ?? '').trim()

  const head = (
    <div className="studio-page-head">
      <div>
        <h1>Аналитика</h1>
        <div className="studio-page-head__sub">Веб-трафик сайта — посетители, просмотры, источники</div>
        <div className="settings__tabs" style={{ marginTop: '.7rem', marginBottom: 0 }}>
          <Link href="/studio/analytics" className="settings__tab is-active" style={{ textDecoration: 'none' }}>Посещаемость</Link>
          <Link href="/studio/analytics/newsletters" className="settings__tab" style={{ textDecoration: 'none' }}>Рассылки</Link>
          <Link href="/studio/analytics/videos" className="settings__tab" style={{ textDecoration: 'none' }}>Видео</Link>
          <Link href="/studio/analytics/team" className="settings__tab" style={{ textDecoration: 'none' }}>Команда</Link>
        </div>
      </div>
      {umamiApiEnabled() && websiteId && (
        <div className="an__ranges" role="tablist" aria-label="Период">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/studio/analytics?range=${r}`}
              role="tab"
              aria-selected={range === r}
              className={'an__range' + (range === r ? ' is-active' : '')}
            >
              {r} дн.
            </Link>
          ))}
        </div>
      )}
    </div>
  )

  // Заглушки: платформа не подключила Umami, либо website не задан для проекта.
  if (!umamiApiEnabled()) {
    return (
      <>
        {head}
        <InfoCard title="Аналитика ещё не подключена">
          Веб-аналитика настраивается на стороне платформы. Как только сбор данных
          включат, здесь появятся посетители, просмотры и источники трафика.
        </InfoCard>
      </>
    )
  }
  if (!websiteId) {
    return (
      <>
        {head}
        <InfoCard title="Сбор данных для проекта не активирован">
          {umamiTrackingEnabled()
            ? 'Для этого проекта пока не привязан сайт в системе аналитики. Обратитесь в поддержку — это делается в пару кликов.'
            : 'Трекер аналитики ещё не подключён. Обратитесь в поддержку, чтобы включить сбор данных для проекта.'}
        </InfoCard>
      </>
    )
  }

  const stats = await getUmamiStats(websiteId, range)
  if (!stats) {
    return (
      <>
        {head}
        <InfoCard title="Не удалось получить данные">
          Сервис аналитики временно недоступен или ещё не накопил статистику.
          Попробуйте обновить страницу позже.
        </InfoCard>
      </>
    )
  }

  return (
    <>
      {head}

      <div className="dash__kpis">
        <div className="dash__kpi">
          <div className="dash__kpi-icon"><Users size={16} /></div>
          <div className="dash__kpi-body">
            <div className="dash__kpi-value">{stats.visitors.value.toLocaleString('ru-RU')}</div>
            <div className="dash__kpi-label">Посетители</div>
          </div>
          <Delta k={stats.visitors} />
        </div>
        <div className="dash__kpi">
          <div className="dash__kpi-icon"><Eye size={16} /></div>
          <div className="dash__kpi-body">
            <div className="dash__kpi-value">{stats.pageviews.value.toLocaleString('ru-RU')}</div>
            <div className="dash__kpi-label">Просмотры</div>
          </div>
          <Delta k={stats.pageviews} />
        </div>
        <div className="dash__kpi">
          <div className="dash__kpi-icon"><Timer size={16} /></div>
          <div className="dash__kpi-body">
            <div className="dash__kpi-value">{formatDuration(stats.avgVisitSec)}</div>
            <div className="dash__kpi-label">Ср. визит</div>
          </div>
        </div>
        <div className="dash__kpi">
          <div className="dash__kpi-icon"><LogOut size={16} /></div>
          <div className="dash__kpi-body">
            <div className="dash__kpi-value">{stats.bounceRate}%</div>
            <div className="dash__kpi-label">Отказы</div>
          </div>
        </div>
      </div>

      <div className="dash__chart-card">
        <UmamiChart series={stats.series} />
      </div>

      <div className="an__grid">
        <MetricList title="Топ страниц" icon={<FileText size={16} />} items={stats.topPages} kind="page" />
        <MetricList title="Источники" icon={<Link2 size={16} />} items={stats.topReferrers} kind="ref" />
      </div>
    </>
  )
}
