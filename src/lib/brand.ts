type Theme = {
  primary?: string | null
  accent?: string | null
  background?: string | null
  surface?: string | null
  text?: string | null
} | null | undefined

/**
 * Brand tokens → CSS variables (ТЗ §1: branding is data, not code).
 * Defaults tuned to the COCO JAMBO mock (purple / neon-sunset K-pop vibe).
 * Only `primary` is set per-tenant today; the rest fall back until filled.
 */
export function brandVars(theme: Theme): React.CSSProperties {
  const primary = theme?.primary || '#7C3AED'
  const accent = theme?.accent || '#EC4899'
  const background = theme?.background || '#0F0A1E'
  const surface = theme?.surface || '#1A1330'
  const text = theme?.text || '#F5F3FF'
  return {
    ['--brand-primary' as any]: primary,
    ['--brand-accent' as any]: accent,
    ['--brand-bg' as any]: background,
    ['--brand-surface' as any]: surface,
    ['--brand-text' as any]: text,
  }
}
