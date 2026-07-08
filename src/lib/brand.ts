type Theme = {
  primary?: string | null
  accent?: string | null
  background?: string | null
  surface?: string | null
  text?: string | null
} | null | undefined

/**
 * Brand tokens → CSS variables (ТЗ §1: branding is data, not code).
 * ТОЛЬКО brand-цвета тенанта (primary/accent) — они одинаковы в обеих темах.
 * Фон/поверхность/текст (--brand-bg/surface/text) задаются классами
 * .theme-dark / .theme-light в styles.css и переключаются посетителем.
 * Поэтому здесь их БОЛЬШЕ НЕТ — иначе inline-style перебил бы классы тем.
 */
export function brandVars(theme: Theme): React.CSSProperties {
  const primary = theme?.primary || '#7C3AED'
  const accent = theme?.accent || '#EC4899'
  return {
    ['--brand-primary' as any]: primary,
    ['--brand-accent' as any]: accent,
  }
}
