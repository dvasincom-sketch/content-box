import React from 'react'

/**
 * Скелетоны загрузки на .c-skeleton (UI-kit). Используются в loading.tsx
 * маршрутов — Next показывает их, пока серверный компонент грузит данные.
 */

function Line({
  w = '100%',
  h = 14,
  mb = 0,
  r = 'var(--radius-sm)',
}: {
  w?: number | string
  h?: number
  mb?: number
  r?: string
}) {
  return <div className="c-skeleton" style={{ width: w, height: h, marginBottom: mb, borderRadius: r }} />
}

export function SkeletonCard() {
  return (
    <div
      style={{
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--brand-border)',
        background: 'var(--glass-1)',
      }}
    >
      <div className="c-skeleton" style={{ aspectRatio: '16 / 10', width: '100%', borderRadius: 0 }} />
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Line w="40%" h={11} />
        <Line w="88%" h={16} />
        <Line w="55%" h={16} />
      </div>
    </div>
  )
}

export function CardGridSkeleton({ count = 8, showTitle = true }: { count?: number; showTitle?: boolean }) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10" aria-busy="true" aria-live="polite">
      {showTitle && (
        <div className="c-skeleton" style={{ height: 34, width: 260, borderRadius: 'var(--radius-sm)', marginBottom: 28 }} />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}

export function ArticleSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10" aria-busy="true" aria-live="polite">
      <Line w={200} h={13} mb={20} />
      <Line w="92%" h={38} mb={12} />
      <Line w="58%" h={38} mb={24} />
      <div
        className="c-skeleton"
        style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--radius-lg)', marginBottom: 28 }}
      />
      {[100, 96, 88, 100, 92, 70, 100, 84].map((w, i) => (
        <Line key={i} w={`${w}%`} h={14} mb={12} />
      ))}
    </div>
  )
}

export function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="max-w-6xl mx-auto px-4 pt-12 pb-8" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Line w="68%" h={44} />
        <Line w="52%" h={44} />
        <Line w="38%" h={44} />
      </div>
      <CardGridSkeleton count={8} showTitle />
    </div>
  )
}

export function SearchSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10" aria-busy="true" aria-live="polite">
      <div
        className="c-skeleton"
        style={{ height: 52, width: '100%', borderRadius: 'var(--radius-md)', marginBottom: 24 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 14,
              padding: 14,
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--brand-border)',
              background: 'var(--glass-1)',
            }}
          >
            <div className="c-skeleton" style={{ width: 60, height: 60, borderRadius: 'var(--radius-md)', flex: '0 0 auto' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
              <Line w="70%" h={16} />
              <Line w="45%" h={12} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
