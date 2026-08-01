import Link from '@/components/AppLink'

export type TagItem = { label: string; slug: string }

/**
 * Чипы тегов. Клик ведёт на страницу тега /tag/<slug> со всеми материалами.
 * Стили инлайном на brand-переменных — не трогаем общий CSS.
 */
export function TagChips({
  tags,
  size = 'md',
}: {
  tags: TagItem[]
  size?: 'sm' | 'md'
}) {
  const clean = (tags || []).filter((t) => t && t.slug && t.label)
  if (clean.length === 0) return null
  const pad = size === 'sm' ? '3px 9px' : '5px 12px'
  const fs = size === 'sm' ? 12 : 13
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {clean.map((t) => (
        <Link
          key={t.slug}
          href={`/tag/${t.slug}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: pad,
            borderRadius: 999,
            fontSize: fs,
            textDecoration: 'none',
            background: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--brand-primary) 26%, transparent)',
            color: 'var(--brand-text)',
          }}
        >
          <span style={{ opacity: 0.6, marginRight: 2 }}>#</span>
          {t.label}
        </Link>
      ))}
    </div>
  )
}
