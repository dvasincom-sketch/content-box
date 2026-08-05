import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { tierWeight } from '@/lib/tierWeight'
import { categoryHref } from '@/lib/categoryHref'
import { Download, Lock, FileDown } from 'lucide-react'
import type { Metadata } from 'next'
import '../styles.css'

/** Витрина «Файлы» — цифровые товары для скачивания по подписке. */
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getTenantFromHeaders()
  const name = (ctx?.tenant as any)?.name || ''
  return { title: name ? `Файлы — ${name}` : 'Файлы' }
}

function formatBytes(n: number | null): string {
  if (!n || n <= 0) return ''
  const u = ['Б', 'КБ', 'МБ', 'ГБ']
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`
}

export default async function DownloadsPage() {
  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>
  const { tenant, settings } = ctx

  const payload = await getPayload({ config: await config })
  const res = await payload.find({
    collection: 'downloads' as any,
    where: { tenant: { equals: tenant.id } },
    sort: '-publishedAt',
    limit: 500,
    depth: 1,
    overrideAccess: true,
  })

  // Эффективный «вес» подписки посетителя: активный, не истёкший, не заблок.
  const viewer = await getCurrentSubscriber(tenant.id).catch(() => null)
  let viewerWeight = -1
  if (viewer && !(viewer as any).isBlocked) {
    const until = (viewer as any).subscriptionUntil ? new Date((viewer as any).subscriptionUntil) : null
    const activeTier = (viewer as any).activeTier
    const activeTierId = activeTier ? (typeof activeTier === 'object' ? activeTier.id : activeTier) : null
    if (until && until.getTime() > Date.now() && activeTierId != null) {
      const w = await tierWeight(payload, activeTierId, tenant.id)
      if (w != null) viewerWeight = w
    }
  }

  const items = (res.docs as any[]).map((d) => {
    const minTier = d.minTier && typeof d.minTier === 'object' ? d.minTier : null
    const minWeight = minTier ? Number(minTier.weight) : null
    const gated = !d.isPreview && !!minTier
    const unlocked = !gated || (minWeight != null && viewerWeight >= minWeight)
    const category = d.category && typeof d.category === 'object' ? d.category : null
    return {
      id: d.id,
      title: d.title || 'Без названия',
      description: d.description || '',
      filesize: typeof d.filesize === 'number' ? d.filesize : null,
      minTierName: minTier ? minTier.name || minTier.slug : null,
      unlocked,
      category,
    }
  })

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl lg:text-5xl font-extrabold mb-2" style={{ color: 'var(--brand-text)' }}>Файлы</h1>
        <p className="mb-8 text-sm" style={{ color: 'var(--brand-muted)' }}>
          Материалы для скачивания. Платные — по активной подписке.
        </p>

        {items.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: 'color-mix(in srgb, var(--brand-primary) 8%, transparent)', color: 'var(--brand-muted)' }}>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3" style={{ background: 'color-mix(in srgb, var(--brand-primary) 18%, transparent)' }}>
              <FileDown size={24} style={{ color: 'var(--brand-primary)' }} />
            </div>
            <div>Пока нет файлов.</div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((it) => (
              <div
                key={it.id}
                className="rounded-2xl p-5 flex flex-col gap-3"
                style={{ background: 'var(--brand-surface)', border: '1px solid color-mix(in srgb, var(--brand-text) 10%, transparent)' }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-none inline-flex items-center justify-center w-11 h-11 rounded-xl" style={{ background: 'color-mix(in srgb, var(--brand-primary) 14%, transparent)' }}>
                    <FileDown size={20} style={{ color: 'var(--brand-primary)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold leading-snug" style={{ color: 'var(--brand-text)' }}>{it.title}</div>
                    <div className="mt-1 text-xs flex flex-wrap items-center gap-x-3 gap-y-1" style={{ color: 'var(--brand-muted)' }}>
                      {it.category && (
                        <Link href={categoryHref(it.category)} className="px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--brand-primary) 18%, transparent)' }}>
                          {it.category.title}
                        </Link>
                      )}
                      {it.filesize != null && <span>{formatBytes(it.filesize)}</span>}
                      {it.minTierName && !it.unlocked && (
                        <span className="inline-flex items-center gap-1"><Lock size={12} /> {it.minTierName}</span>
                      )}
                    </div>
                  </div>
                </div>

                {it.description && (
                  <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--brand-text)', opacity: 0.85 }}>
                    {it.description}
                  </p>
                )}

                <div className="mt-auto pt-1">
                  {it.unlocked ? (
                    <a
                      href={`/api/download/${it.id}`}
                      className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-transform hover:-translate-y-0.5"
                      style={{ background: 'var(--brand-primary)', color: '#fff' }}
                    >
                      <Download size={16} /> Скачать
                    </a>
                  ) : (
                    <Link
                      href="/subscribe"
                      className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl"
                      style={{ background: 'color-mix(in srgb, var(--brand-text) 8%, transparent)', color: 'var(--brand-text)' }}
                    >
                      <Lock size={16} /> Доступно по подписке
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
