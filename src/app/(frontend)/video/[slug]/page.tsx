import Link from 'next/link'
import Image from 'next/image'
import { categoryHref } from '@/lib/categoryHref'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { checkVideoAccess } from '@/lib/videoAccess'
import { notFound } from 'next/navigation'
import { Lock } from 'lucide-react'
import { VideoPlayer } from './VideoPlayer'
import type { Metadata } from 'next'
import '../../styles.css'

type Params = { slug: string }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const ctx = await getTenantFromHeaders()
  if (!ctx) return {}
  const access = await checkVideoAccess({ slug, tenantId: ctx.tenant.id })
  const title = access.video?.title
  return title ? { title: `${title} — ${(ctx.tenant as any)?.name || ''}`.trim() } : {}
}

export default async function VideoPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params

  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>
  const { tenant, settings } = ctx

  // Проверка доступа (гейтинг по подписке) — единый источник правды
  const access = await checkVideoAccess({ slug, tenantId: tenant.id })

  if (access.reason === 'not-found') notFound()

  const video = access.video
  const category = video.category && typeof video.category === 'object' ? video.category : null
  const dateStr = video.publishedAt
    ? new Date(video.publishedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <main style={{ ...brandVars(settings?.theme), background: 'var(--brand-bg)', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Хлебные крошки */}
        <nav className="text-sm mb-6 flex flex-wrap items-center gap-x-2 gap-y-1"
          style={{ color: 'var(--brand-text)', opacity: 0.7 }}
          aria-label="Хлебные крошки">
          <Link href="/" className="hover:opacity-100">Главная</Link>
          {((category?.breadcrumbs ?? []) as { url?: string; label?: string }[]).map((crumb, i) => (
            <span key={crumb.url ?? i} className="flex items-center gap-x-2">
              <span aria-hidden="true">/</span>
              <Link href={`/category${crumb.url}`} className="hover:opacity-100">{crumb.label}</Link>
            </span>
          ))}
          <span aria-hidden="true">/</span>
          <span style={{ opacity: 1 }}>{video.title}</span>
        </nav>

        <div className="flex items-center gap-3 mb-4 text-sm" style={{ color: 'var(--brand-text)', opacity: 0.7 }}>
          {category && (
            <Link href={categoryHref(category)} className="px-3 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--brand-primary) 25%, transparent)' }}>{category.title}</Link>
          )}
          {dateStr && <span>{dateStr}</span>}
        </div>

        <h1 className="text-3xl lg:text-5xl font-extrabold mb-6" style={{ color: 'var(--brand-text)' }}>{video.title}</h1>

        {/* Плеер (если доступ) или замок (если нет) */}
        {access.allowed ? (
          <VideoPlayer videoId={video.id} />
        ) : (
          <VideoLock reason={access.reason} requiredTierName={access.requiredTierName} cover={video.cover} settings={settings} />
        )}

        {/* Описание (textarea — обычный текст, не richText) */}
        {video.description && (
          <div className="max-w-none leading-relaxed whitespace-pre-line" style={{ color: 'var(--brand-text)', opacity: 0.9 }}>
            {video.description}
          </div>
        )}
      </div>
    </main>
  )
}

/* Блок «замок» — доступ по подписке. Точка продажи, а не тупик. */
function VideoLock({
  reason,
  requiredTierName,
  cover,
  settings,
}: {
  reason: 'need-login' | 'need-subscription' | 'expired' | 'blocked'
  requiredTierName?: string | null
  cover?: any
  settings?: any
}) {
  const coverUrl = cover && typeof cover === 'object' && cover.url ? cover.url : null

  const heading =
    reason === 'need-login'
      ? 'Войдите, чтобы смотреть'
      : reason === 'expired'
        ? 'Подписка истекла'
        : reason === 'blocked'
          ? 'Доступ ограничен'
          : 'Доступно по подписке'

  const text =
    reason === 'need-login'
      ? 'Это видео доступно подписчикам. Войдите в аккаунт или оформите подписку.'
      : reason === 'expired'
        ? 'Продлите подписку, чтобы снова открыть это видео и весь премиум-контент.'
        : reason === 'blocked'
          ? 'Ваш аккаунт временно ограничен. Свяжитесь с поддержкой.'
          : requiredTierName
            ? `Это видео открыто на уровне «${requiredTierName}» и выше.`
            : 'Это видео доступно подписчикам.'

  return (
    <div
      className="relative rounded-2xl h-64 lg:h-96 mb-8 overflow-hidden flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))' }}
    >
      {coverUrl && (
        <Image src={coverUrl} alt="" fill className="object-cover" style={{ opacity: 0.25 }} sizes="(max-width: 768px) 100vw, 768px" />
      )}
      <div className="relative z-10 text-center px-6 max-w-md">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
          style={{ background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(6px)' }}>
          <Lock size={24} color="#fff" />
        </div>
        <div className="text-2xl font-bold mb-2" style={{ color: '#fff' }}>{heading}</div>
        <p className="mb-6 text-sm" style={{ color: '#fff', opacity: 0.9 }}>{text}</p>
        {reason !== 'blocked' && (
          <Link href="/subscribe"
            className="inline-block text-sm font-semibold px-6 py-3 rounded-xl transition-transform hover:-translate-y-0.5"
            style={{ background: '#fff', color: 'var(--brand-primary)' }}>
            {reason === 'expired' ? 'Продлить подписку' : reason === 'need-login' ? 'Войти или подписаться' : 'Оформить подписку'}
          </Link>
        )}
      </div>
    </div>
  )
}
