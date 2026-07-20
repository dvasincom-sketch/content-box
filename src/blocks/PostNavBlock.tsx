import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react'

/** Один сосед для навигации под публикацией. */
export type PostNavItem = {
  title: string
  href: string
  categoryTitle?: string | null
  coverUrl?: string | null
  isPremium?: boolean
  /** prev/next — настоящий сосед по дате; related — случайный (край ленты). */
  kind: 'prev' | 'next' | 'related'
}

export type PostNavBlockProps = {
  prev?: PostNavItem | null
  next?: PostNavItem | null
}

const KIND_LABEL: Record<PostNavItem['kind'], string> = {
  prev: 'Предыдущая',
  next: 'Следующая',
  related: 'Читайте также',
}

/**
 * Навигация между публикациями внизу поста: до двух карточек (предыдущая /
 * следующая по дате; на краю ленты — случайная с подписью «Читайте также»).
 * Карточка: обложка (или градиент-фолбэк) + категория + название, бейдж «по
 * подписке» для premium-постов (minTier задан). Стиль — язык сайта: --brand-*
 * токены, скругления, градиент как у обложек.
 */
export function PostNavBlock({ prev, next }: PostNavBlockProps) {
  if (!prev && !next) return null

  return (
    <nav
      className="mt-16 pt-10"
      style={{ borderTop: '1px solid color-mix(in srgb, var(--brand-text) 12%, transparent)' }}
      aria-label="Другие публикации"
    >
      <span
        className="block text-xs font-semibold uppercase tracking-[0.2em] mb-5"
        style={{ color: 'var(--brand-text)', opacity: 0.55 }}
      >
        Ещё публикации
      </span>

      <div className="grid gap-4 sm:grid-cols-2">
        {prev ? <NavCard item={prev} align="start" /> : <span className="hidden sm:block" />}
        {next ? <NavCard item={next} align="end" /> : <span className="hidden sm:block" />}
      </div>
    </nav>
  )
}

function NavCard({ item, align }: { item: PostNavItem; align: 'start' | 'end' }) {
  const isEnd = align === 'end'

  return (
    <Link
      href={item.href}
      className="group relative flex gap-4 rounded-2xl p-3 transition-all hover:-translate-y-0.5"
      style={{
        background: 'color-mix(in srgb, var(--brand-primary) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--brand-primary) 18%, transparent)',
      }}
    >
      {/* Обложка слева для prev/related, справа для next — направление читается вёрсткой */}
      <div className={`order-1 ${isEnd ? 'sm:order-2' : ''}`}>
        <div
          className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))' }}
        >
          {item.coverUrl && (
            <Image
              src={item.coverUrl}
              alt={item.title}
              fill
              className="object-cover"
              sizes="96px"
            />
          )}
          {item.isPremium && (
            <span
              className="absolute top-1 left-1 inline-flex items-center justify-center w-6 h-6 rounded-full"
              style={{ background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }}
              title="Доступно по подписке"
            >
              <Lock size={12} color="#fff" />
            </span>
          )}
        </div>
      </div>

      {/* Текст */}
      <div
        className={`order-2 min-w-0 flex flex-col justify-center ${isEnd ? 'sm:order-1 sm:text-right sm:items-end' : ''}`}
      >
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-1.5 ${
            isEnd ? 'sm:flex-row-reverse' : ''
          }`}
          style={{ color: 'var(--brand-primary)' }}
        >
          {item.kind === 'prev' && <ArrowLeft size={13} />}
          {item.kind === 'next' && <ArrowRight size={13} />}
          {KIND_LABEL[item.kind]}
        </span>

        {item.categoryTitle && (
          <span
            className="text-xs mb-0.5 truncate max-w-full"
            style={{ color: 'var(--brand-text)', opacity: 0.55 }}
          >
            {item.categoryTitle}
          </span>
        )}

        <span
          className="text-sm lg:text-base font-bold leading-snug"
          style={{
            color: 'var(--brand-text)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.isPremium && (
            <span
              className="inline-block text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded mr-1.5 align-middle"
              style={{
                background: 'color-mix(in srgb, var(--brand-primary) 20%, transparent)',
                color: 'var(--brand-primary)',
              }}
            >
              По подписке
            </span>
          )}
          {item.title}
        </span>
      </div>
    </Link>
  )
}
