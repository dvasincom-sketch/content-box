import React from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Пагинация + переключатель размера страницы для списков (SSR-ссылки, без
 * клиентского JS). Сохраняет прочие query-параметры при переходе. `tone`
 * выбирает палитру: 'brand' — фан-сайт (brand-токены), 'studio' — студия
 * (st-токены). Не браузерный дефолт.
 */
const PER_OPTIONS = [25, 50, 100]

type Tone = 'brand' | 'studio'
function tokens(tone: Tone) {
  return tone === 'studio'
    ? { primary: 'var(--st-accent)', onPrimary: 'var(--st-accent-text, #fff)', border: 'var(--st-border)', surface: 'var(--st-surface)', text: 'var(--st-text)', muted: 'var(--st-text-muted)' }
    : { primary: 'var(--brand-primary)', onPrimary: '#fff', border: 'var(--brand-border)', surface: 'var(--brand-surface, #fff)', text: 'var(--brand-text)', muted: 'var(--brand-muted)' }
}

export function ListPagination({
  page, totalPages, per, total, basePath, query = {}, tone = 'brand',
}: {
  page: number
  totalPages: number
  per: number
  total: number
  basePath: string
  query?: Record<string, string | undefined>
  tone?: Tone
}) {
  if (total <= PER_OPTIONS[0] && totalPages <= 1) return null
  const T = tokens(tone)

  const build = (params: Record<string, string | undefined>): string => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...query, ...params })) if (v) sp.set(k, String(v))
    const qs = sp.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }
  const hrefPage = (p: number) => build({ per: per !== PER_OPTIONS[0] ? String(per) : undefined, page: p > 1 ? String(p) : undefined })
  const hrefPer = (pp: number) => build({ per: pp !== PER_OPTIONS[0] ? String(pp) : undefined })

  const nums: (number | '…')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) nums.push(i)
    else if (nums[nums.length - 1] !== '…') nums.push('…')
  }

  const pill: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 38, height: 38, padding: '0 12px',
    borderRadius: 11, fontSize: 14, fontWeight: 600, textDecoration: 'none', border: `1px solid ${T.border}`,
    background: T.surface, color: T.text,
  }
  const activePill: React.CSSProperties = { ...pill, background: T.primary, color: T.onPrimary, border: '1px solid transparent' }
  const ghost: React.CSSProperties = { ...pill, minWidth: 38, padding: 0 }
  const disabled: React.CSSProperties = { ...ghost, opacity: 0.4, pointerEvents: 'none' }
  const small: React.CSSProperties = { ...pill, height: 34, minWidth: 0, padding: '0 12px', fontSize: 13 }
  const smallActive: React.CSSProperties = { ...small, background: T.primary, color: T.onPrimary, border: '1px solid transparent' }

  return (
    <nav aria-label="Постраничная навигация" style={{ marginTop: 28, paddingTop: 18, borderTop: `1px solid ${T.border}`,
      display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: T.muted }}>Показывать по:</span>
        {PER_OPTIONS.map((pp) => (
          <Link key={pp} href={hrefPer(pp)} scroll={false} aria-current={pp === per ? 'true' : undefined}
            style={pp === per ? smallActive : small}>{pp}</Link>
        ))}
        <span style={{ fontSize: 13, color: T.muted, marginLeft: 4 }}>из {total}</span>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {page > 1
            ? <Link href={hrefPage(page - 1)} aria-label="Назад" style={ghost}><ChevronLeft size={18} /></Link>
            : <span aria-hidden style={disabled}><ChevronLeft size={18} /></span>}
          {nums.map((n, i) => n === '…'
            ? <span key={`e${i}`} style={{ ...ghost, border: 'none', background: 'transparent', color: T.muted }}>…</span>
            : <Link key={n} href={hrefPage(n)} aria-current={n === page ? 'page' : undefined} style={n === page ? activePill : pill}>{n}</Link>)}
          {page < totalPages
            ? <Link href={hrefPage(page + 1)} aria-label="Вперёд" style={ghost}><ChevronRight size={18} /></Link>
            : <span aria-hidden style={disabled}><ChevronRight size={18} /></span>}
        </div>
      )}
    </nav>
  )
}
