import React from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Пагинация + переключатель размера страницы для списков (разделы фан-сайта).
 * Полностью серверный рендер ссылок (SSR, без клиентского JS) в фирменном
 * стиле сайта (brand-токены), не браузерный дефолт. Сохраняет прочие query-
 * параметры (сортировка/даты события) при переходе по страницам.
 */
const PER_OPTIONS = [25, 50, 100]

export function ListPagination({
  page, totalPages, per, total, basePath, query = {},
}: {
  page: number
  totalPages: number
  per: number
  total: number
  basePath: string
  query?: Record<string, string | undefined>
}) {
  if (total <= PER_OPTIONS[0] && totalPages <= 1) return null

  const build = (params: Record<string, string | undefined>): string => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...query, ...params })) if (v) sp.set(k, String(v))
    const qs = sp.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }
  const hrefPage = (p: number) => build({ per: per !== PER_OPTIONS[0] ? String(per) : undefined, page: p > 1 ? String(p) : undefined })
  const hrefPer = (pp: number) => build({ per: pp !== PER_OPTIONS[0] ? String(pp) : undefined }) // размер меняем — страница сбрасывается

  // Оконный список номеров: 1 … p-1 p p+1 … N
  const nums: (number | '…')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) nums.push(i)
    else if (nums[nums.length - 1] !== '…') nums.push('…')
  }

  const pill: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 38, height: 38, padding: '0 12px',
    borderRadius: 11, fontSize: 14, fontWeight: 600, textDecoration: 'none', border: '1px solid var(--brand-border)',
    background: 'var(--brand-surface, #fff)', color: 'var(--brand-text)',
  }
  const active: React.CSSProperties = { ...pill, background: 'var(--brand-primary)', color: '#fff', border: '1px solid transparent' }
  const ghost: React.CSSProperties = { ...pill, minWidth: 38, padding: 0 }
  const disabled: React.CSSProperties = { ...ghost, opacity: 0.4, pointerEvents: 'none' }
  const small: React.CSSProperties = { ...pill, height: 34, minWidth: 0, padding: '0 12px', fontSize: 13 }

  return (
    <nav aria-label="Постраничная навигация" style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--brand-border)',
      display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
      {/* размер страницы */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--brand-muted)' }}>Показывать по:</span>
        {PER_OPTIONS.map((pp) => (
          <Link key={pp} href={hrefPer(pp)} scroll={false} aria-current={pp === per ? 'true' : undefined}
            style={pp === per ? { ...small, background: 'var(--brand-primary)', color: '#fff', border: '1px solid transparent' } : small}>{pp}</Link>
        ))}
        <span style={{ fontSize: 13, color: 'var(--brand-muted)', marginLeft: 4 }}>из {total}</span>
      </div>

      {/* страницы */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {page > 1
            ? <Link href={hrefPage(page - 1)} aria-label="Назад" style={ghost}><ChevronLeft size={18} /></Link>
            : <span aria-hidden style={disabled}><ChevronLeft size={18} /></span>}
          {nums.map((n, i) => n === '…'
            ? <span key={`e${i}`} style={{ ...ghost, border: 'none', background: 'transparent', color: 'var(--brand-muted)' }}>…</span>
            : <Link key={n} href={hrefPage(n)} aria-current={n === page ? 'page' : undefined} style={n === page ? active : pill}>{n}</Link>)}
          {page < totalPages
            ? <Link href={hrefPage(page + 1)} aria-label="Вперёд" style={ghost}><ChevronRight size={18} /></Link>
            : <span aria-hidden style={disabled}><ChevronRight size={18} /></span>}
        </div>
      )}
    </nav>
  )
}
