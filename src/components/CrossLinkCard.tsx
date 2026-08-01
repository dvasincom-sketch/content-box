import Link from '@/components/AppLink'
import { Play, BookOpen, ArrowRight } from 'lucide-react'

/**
 * Карточка-связка между блоками «Смотреть» и «Мир BTS».
 *
 *  variant='watch' — на странице статьи «Мира BTS»: увести читателя органики
 *                    в видеораздел «Смотреть».
 *  variant='read'  — на странице категории «Смотреть»: увести в статью-
 *                    энциклопедию «Мира BTS».
 *
 * Стили — инлайном через brand-переменные (как на страницах публикации и
 * категории), чтобы не трогать три несведённые CSS-системы проекта.
 */
export function CrossLinkCard({
  href,
  variant,
  title,
  path,
}: {
  href: string
  variant: 'watch' | 'read'
  title: string
  /** Путь-хлебные крошки цели, например «Шоу и проекты». */
  path?: string | null
}) {
  const kicker = variant === 'watch' ? 'Смотреть видео' : 'Читать в «Мире BTS»'
  const Icon = variant === 'watch' ? Play : BookOpen

  return (
    <Link
      href={href}
      className="crosslink-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 18px',
        borderRadius: 18,
        textDecoration: 'none',
        background: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)',
        border: '1px solid color-mix(in srgb, var(--brand-primary) 28%, transparent)',
        color: 'var(--brand-text)',
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
          width: 40,
          height: 40,
          borderRadius: '9999px',
          background: 'color-mix(in srgb, var(--brand-primary) 22%, transparent)',
        }}
      >
        <Icon size={20} style={{ color: 'var(--brand-primary)' }} />
      </span>

      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 auto' }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--brand-muted)',
          }}
        >
          {kicker}
        </span>
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            lineHeight: 1.25,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </span>
        {path ? (
          <span
            style={{
              fontSize: 13,
              color: 'var(--brand-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {path}
          </span>
        ) : null}
      </span>

      <ArrowRight size={18} style={{ flex: '0 0 auto', color: 'var(--brand-primary)' }} aria-hidden />
    </Link>
  )
}

/** Метки хлебных крошек категории → «A → B → C». Последняя крошка обычно сама
 *  категория, поэтому по умолчанию отбрасываем её (dropLast). */
export function breadcrumbLabelPath(
  breadcrumbs: { label?: string | null }[] | null | undefined,
  dropLast = true,
): string | null {
  if (!Array.isArray(breadcrumbs) || breadcrumbs.length === 0) return null
  const labels = breadcrumbs
    .map((c) => c?.label)
    .filter((l): l is string => typeof l === 'string' && l.length > 0)
  const trimmed = dropLast ? labels.slice(0, -1) : labels
  return trimmed.length > 0 ? trimmed.join(' → ') : null
}
