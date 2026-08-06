import React from 'react'
import Link from 'next/link'
import { Plus, FolderTree, FileText, FileEdit, ArrowRight, HardDrive, Image as ImageIcon, Images, FileDown, Users, CreditCard, TrendingUp, Wallet } from 'lucide-react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { requireAuthor } from '@/lib/currentAuthor'
import { getMediaStats, formatBytes } from '@/lib/mediaStats'
import { getCommerceStats, formatRub } from '@/lib/commerceStats'
import { DashChart } from './DashChart'

/**
 * Дашборд студии (витрина, референс Patreon Creator Studio):
 *  - статистика: всего публикаций / черновиков / категорий;
 *  - быстрые действия;
 *  - черновики, требующие внимания;
 *  - последние публикации (мини-лента).
 *
 * Всё из существующих коллекций. Статус выводим из publishedAt:
 *   есть дата в прошлом → опубликовано, иначе → черновик.
 */

export const dynamic = 'force-dynamic'

type Pub = {
  id: number | string
  title?: string
  publishedAt?: string | null
  category?: any
  cover?: any
}

function isDraft(p: Pub): boolean {
  if (!p.publishedAt) return true
  const t = new Date(p.publishedAt).getTime()
  return Number.isNaN(t) || t > Date.now()
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export default async function StudioDashboard() {
  const author = await requireAuthor()
  const payload = await getPayload({ config: await config })
  const tenantId = author!.tenantId

  // Для счётчиков берём limit:1 и читаем totalDocs — не тянем все документы
  // в память (в Payload limit:0 означало бы «без лимита», грузило бы всё).
  const now = new Date().toISOString()
  const [pubsTotal, draftsRes, catsTotal, recentRes] = await Promise.all([
    payload.find({
      collection: 'publications',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
    // Черновики: нет даты ИЛИ дата в будущем
    payload.find({
      collection: 'publications',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { or: [{ publishedAt: { exists: false } }, { publishedAt: { greater_than: now } }] },
        ],
      },
      sort: '-updatedAt',
      limit: 5,
      depth: 1,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'categories',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
    // Последние по дате публикации/обновления
    payload.find({
      collection: 'publications',
      where: { tenant: { equals: tenantId } },
      sort: '-publishedAt',
      limit: 5,
      depth: 1,
      overrideAccess: true,
    }),
  ])

  const totalPubs = pubsTotal.totalDocs
  const totalDrafts = draftsRes.totalDocs
  const totalCats = catsTotal.totalDocs
  const drafts = draftsRes.docs as Pub[]
  const recent = recentRes.docs as Pub[]

  // Медиа-статистика (файлы + фактический объём на диске) отдельным SQL-агрегатом.
  const media = await getMediaStats(payload, tenantId)
  const commerce = await getCommerceStats(payload, tenantId)

  const email = author!.user.email

  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Дашборд</h1>
          <div className="studio-page-head__sub">Вы вошли как {email}</div>
        </div>
        <Link href="/studio/posts/new" className="studio-btn studio-btn--primary">
          <Plus size={18} />
          Новая публикация
        </Link>
      </div>

      {/* Первый экран: ключевые коммерческие метрики + динамика */}
      {commerce ? (
        <>
          <div className="dash__kpis">
            <div className="dash__kpi">
              <div className="dash__kpi-icon"><Users size={16} /></div>
              <div className="dash__kpi-body">
                <div className="dash__kpi-value">{commerce.registered}</div>
                <div className="dash__kpi-label">Зарегистрировано</div>
              </div>
              {commerce.registered7d > 0 && (
                <div className="dash__kpi-delta">+{commerce.registered7d} за 7 дн.</div>
              )}
            </div>
            <div className="dash__kpi">
              <div className="dash__kpi-icon"><CreditCard size={16} /></div>
              <div className="dash__kpi-body">
                <div className="dash__kpi-value">{commerce.paid}</div>
                <div className="dash__kpi-label">Платных</div>
              </div>
            </div>
            <div className="dash__kpi">
              <div className="dash__kpi-icon"><TrendingUp size={16} /></div>
              <div className="dash__kpi-body">
                <div className="dash__kpi-value">{commerce.conversion}%</div>
                <div className="dash__kpi-label">Конверсия</div>
              </div>
            </div>
            <div className="dash__kpi">
              <div className="dash__kpi-icon"><Wallet size={16} /></div>
              <div className="dash__kpi-body">
                <div className="dash__kpi-value">{formatRub(commerce.mrr)}</div>
                <div className="dash__kpi-label">Выручка в мес.</div>
              </div>
            </div>
          </div>
          <div className="dash__chart-card">
            <DashChart series={commerce.series} />
          </div>
        </>
      ) : (
        <div className="dash__stats">
          <div className="dash__stat">
            <div className="dash__stat-value">{totalPubs}</div>
            <div className="dash__stat-label">Публикаций</div>
          </div>
          <div className="dash__stat">
            <div className="dash__stat-value">{totalDrafts}</div>
            <div className="dash__stat-label">Черновиков</div>
          </div>
          <div className="dash__stat">
            <div className="dash__stat-value">{totalCats}</div>
            <div className="dash__stat-label">Категорий</div>
          </div>
        </div>
      )}

      {/* Вторичные показатели контента (ниже первого экрана) */}
      <div className="dash__substats">
        <span className="dash__substat"><FileText size={14} /> {totalPubs} публикаций</span>
        <span className="dash__substat"><FileEdit size={14} /> {totalDrafts} черновиков</span>
        <span className="dash__substat"><FolderTree size={14} /> {totalCats} категорий</span>
      </div>

      {/* Медиа: файлы + объём на диске */}
      {media && (
        <section className="dash__section">
          <div className="dash__section-head">
            <h2><HardDrive size={16} /> Медиа</h2>
            <Link href="/studio/gallery" className="dash__section-link">
              Галерея <ArrowRight size={14} />
            </Link>
          </div>
          <div className="dash__stats dash__stats--2">
            <div className="dash__stat">
              <div className="dash__stat-value">{media.files}</div>
              <div className="dash__stat-label">Файлов загружено</div>
            </div>
            <div className="dash__stat">
              <div className="dash__stat-value">{formatBytes(media.bytes)}</div>
              <div className="dash__stat-label">Занято на диске</div>
            </div>
          </div>
          {media.files > 0 && (
            <div className="dash__mediabreak">
              {media.sources.filter((sMedia) => sMedia.files > 0).map((sMedia) => (
                <div key={sMedia.key} className="dash__mediabreak-row">
                  <span className="dash__mediabreak-icon">
                    {sMedia.key === 'gallery' ? <Images size={15} /> : sMedia.key === 'downloads' ? <FileDown size={15} /> : <ImageIcon size={15} />}
                  </span>
                  <span className="dash__mediabreak-label">{sMedia.label}</span>
                  <span className="dash__mediabreak-count">{sMedia.files} файл.</span>
                  <span className="dash__mediabreak-size">{formatBytes(sMedia.bytes)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Быстрые действия */}
      <div className="dash__actions">
        <Link href="/studio/posts/new" className="dash__action">
          <div className="dash__action-icon"><Plus size={18} /></div>
          <div>
            <div className="dash__action-title">Написать публикацию</div>
            <div className="dash__action-sub">Заголовок, обложка, текст, доступ</div>
          </div>
        </Link>
        <Link href="/studio/categories" className="dash__action">
          <div className="dash__action-icon"><FolderTree size={18} /></div>
          <div>
            <div className="dash__action-title">Управлять категориями</div>
            <div className="dash__action-sub">Дерево разделов сайта</div>
          </div>
        </Link>
      </div>

      {/* Черновики, требующие внимания */}
      {drafts.length > 0 && (
        <section className="dash__section">
          <div className="dash__section-head">
            <h2><FileEdit size={16} /> Черновики</h2>
            <Link href="/studio/posts" className="dash__section-link">
              Все <ArrowRight size={14} />
            </Link>
          </div>
          <div className="dash__mini">
            {drafts.map((p) => (
              <Link key={p.id} href={`/studio/posts/${p.id}`} className="dash__mini-row">
                <FileEdit size={15} className="dash__mini-icon" />
                <span className="dash__mini-title">{p.title || 'Без заголовка'}</span>
                <span className="studio-status studio-status--draft">Черновик</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Последние публикации */}
      <section className="dash__section">
        <div className="dash__section-head">
          <h2><FileText size={16} /> Последние публикации</h2>
          <Link href="/studio/posts" className="dash__section-link">
            Все <ArrowRight size={14} />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="studio-card">
            <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>
              Публикаций пока нет. <Link href="/studio/posts/new" style={{ color: 'var(--st-text)', textDecoration: 'underline' }}>Создайте первую</Link>.
            </p>
          </div>
        ) : (
          <div className="dash__mini">
            {recent.map((p) => {
              const draft = isDraft(p)
              const cat =
                p.category && typeof p.category === 'object'
                  ? p.category.title || p.category.name
                  : null
              return (
                <Link key={p.id} href={`/studio/posts/${p.id}`} className="dash__mini-row">
                  <FileText size={15} className="dash__mini-icon" />
                  <span className="dash__mini-title">{p.title || 'Без заголовка'}</span>
                  {cat && <span className="dash__mini-cat">{cat}</span>}
                  <span className="dash__mini-date">{fmtDate(p.publishedAt)}</span>
                  <span className={`studio-status studio-status--${draft ? 'draft' : 'published'}`}>
                    {draft ? 'Черновик' : 'Опубликовано'}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
