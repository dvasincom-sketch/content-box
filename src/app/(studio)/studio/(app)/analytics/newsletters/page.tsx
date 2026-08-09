import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload, type Where } from 'payload'
import config from '@/payload.config'
import { Mail, Users, ShieldCheck } from 'lucide-react'
import { requireAuthor } from '@/lib/currentAuthor'
import { listmonkEnabled, getTenantDigests, type DigestStat } from '@/lib/listmonk'

export const dynamic = 'force-dynamic'

/**
 * Студия → Аналитика → Рассылки (owner-only, read-only).
 * Обзор аудитории — из Payload (доступно сразу). Реакция на дайджесты —
 * из Listmonk (после роутинга дайджестов через него). Создание рассылок
 * авторам недоступно — политика платформы.
 */
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

export default async function NewslettersAnalytics() {
  const author = await requireAuthor()
  const isOwner = (author!.user as { tenantRole?: string | null }).tenantRole !== 'contributor'
  if (!isOwner) redirect('/studio')

  const payload = await getPayload({ config: await config })
  const tenantId = author!.tenantId
  const nowISO = new Date().toISOString()

  const base = (extra: Where[] = []): Where => ({ and: [{ tenant: { equals: tenantId } }, ...extra] })

  const tiersRes = await payload.find({
    collection: 'subscription-tiers',
    where: { and: [{ tenant: { equals: tenantId } }, { isActive: { equals: true } }, { priceRub: { greater_than: 0 } }] },
    sort: 'weight', depth: 0, limit: 50, overrideAccess: true,
  })
  const tiers = tiersRes.docs as { id: number | string; name: string; priceRub: number }[]

  const total = (await payload.count({ collection: 'subscribers', where: base(), overrideAccess: true })).totalDocs
  const optIn = (await payload.count({ collection: 'subscribers', where: base([{ notifyDigest: { equals: true } }, { isBlocked: { not_equals: true } }]), overrideAccess: true })).totalDocs

  const perTier = await Promise.all(
    tiers.map(async (t) => ({
      id: t.id,
      name: t.name,
      count: (await payload.count({
        collection: 'subscribers',
        where: base([{ activeTier: { equals: t.id } }, { subscriptionUntil: { greater_than: nowISO } }]),
        overrideAccess: true,
      })).totalDocs,
    })),
  )
  const paid = perTier.reduce((s, t) => s + t.count, 0)
  const free = Math.max(0, total - paid)

  const digests: DigestStat[] = await getTenantDigests(tenantId)
  const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)

  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Рассылки</h1>
          <div className="studio-page-head__sub">Дайджесты новинок и отклик аудитории</div>
          <div className="settings__tabs" style={{ marginTop: '.7rem', marginBottom: 0 }}>
            <Link href="/studio/analytics" className="settings__tab" style={{ textDecoration: 'none' }}>Посещаемость</Link>
            <Link href="/studio/analytics/newsletters" className="settings__tab is-active" style={{ textDecoration: 'none' }}>Рассылки</Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720 }}>
        <div className="nl-policy">
          <ShieldCheck size={18} />
          <span>Дайджесты рассылает платформа автоматически. Создание собственных рассылок недоступно — так мы бережём доверие вашей аудитории и её почтовые ящики.</span>
        </div>

        {/* Главное — сами выпуски дайджеста и отклик на них. */}
        <section className="studio-card">
          <div className="an__list-head"><Mail size={16} /> Выпуски дайджеста</div>
          {!listmonkEnabled() ? (
            <div className="an__empty">
              Платформа отправляет дайджест новинок вашим подписчикам автоматически.
              Как только выпуски начнут уходить, здесь появится их история: тема, дата,
              сколько получателей, а также открытия и клики по каждому выпуску.
            </div>
          ) : digests.length === 0 ? (
            <div className="an__empty">
              Дайджест ещё не отправлялся. Первый выпуск появится здесь автоматически —
              вместе с откликом аудитории (открытия и клики).
            </div>
          ) : (
            <div className="nl-table">
              <div className="nl-row nl-row--head">
                <span>Выпуск</span><span>Получатели</span><span>Открытий</span><span>Кликов</span>
              </div>
              {digests.map((d) => (
                <div key={d.id} className="nl-row">
                  <span className="nl-row__subj" title={d.subject}>
                    {d.subject}
                    <span style={{ color: 'var(--st-text-muted)', fontWeight: 400 }}>
                      {' · '}{fmtDate(d.createdAt)}{d.segment ? ` · ${d.segment}` : ''}
                    </span>
                  </span>
                  <span>{d.sent}</span>
                  <span>{rate(d.views, d.sent)}%</span>
                  <span>{rate(d.clicks, d.sent)}%</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Аудитория — компактная сводка. */}
        <section className="studio-card" style={{ marginTop: '1rem' }}>
          <div className="an__list-head"><Users size={16} /> Кто получает дайджест</div>
          <div className="nl-kpis">
            <div className="nl-kpi"><div className="nl-kpi__n">{optIn}</div><div className="nl-kpi__l">получают дайджест</div></div>
            <div className="nl-kpi"><div className="nl-kpi__n">{total}</div><div className="nl-kpi__l">всего подписчиков</div></div>
            <div className="nl-kpi"><div className="nl-kpi__n">{paid}</div><div className="nl-kpi__l">платные</div></div>
            <div className="nl-kpi"><div className="nl-kpi__n">{free}</div><div className="nl-kpi__l">бесплатные</div></div>
          </div>
        </section>
      </div>
    </>
  )
}
