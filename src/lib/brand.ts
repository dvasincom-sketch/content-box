type Theme = {
  primary?: string | null
  accent?: string | null
  background?: string | null
  surface?: string | null
  text?: string | null
  typography?: {
    headingFont?: string | null
    bodyFont?: string | null
    textSize?: string | null
    textWeight?: string | null
    headingWeight?: string | null
  } | null
} | null | undefined

const FONT_VAR: Record<string, string> = {
  inter: 'var(--font-inter)',
  montserrat: 'var(--font-montserrat)',
  manrope: 'var(--font-manrope)',
  golos: 'var(--font-golos)',
  ptsans: 'var(--font-ptsans)',
  unbounded: 'var(--font-unbounded)',
  roboto: 'var(--font-roboto)',
}

function fontVar(key?: string | null): string {
  return FONT_VAR[key || 'inter'] || FONT_VAR.inter
}

/**
 * Brand tokens → CSS variables (ТЗ §1: branding is data, not code).
 * Colors (primary/accent) + typography (fonts/sizes/weights) from the tenant.
 * bg/surface/text switch via .theme-dark/.theme-light classes, not here.
 */
export function brandVars(theme: Theme, typography?: Theme extends null ? never : any): React.CSSProperties {
  const primary = theme?.primary || '#7C3AED'
  const accent = theme?.accent || '#EC4899'
  const t = typography ?? theme?.typography

  return {
    ['--brand-primary' as any]: primary,
    ['--brand-accent' as any]: accent,
    ['--font-heading' as any]: fontVar(t?.headingFont),
    ['--font-body' as any]: fontVar(t?.bodyFont),
    ['--text-size' as any]: `${t?.textSize || '18'}px`,
    ['--text-weight' as any]: t?.textWeight || '400',
    ['--heading-weight' as any]: t?.headingWeight || '700',
  }
}
