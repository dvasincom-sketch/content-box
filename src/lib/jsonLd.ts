/**
 * Билдеры микроразметки Schema.org (JSON-LD) для фронта.
 *
 * Все функции чистые и возвращают либо готовый объект разметки, либо null
 * (например, если нет домена — тогда абсолютные URL построить нельзя и блок
 * просто не выводится). Рендерит их компонент <JsonLd data={...} />.
 *
 * Абсолютные URL строим от домена тенанта (tenant.domain) — на каждом домене
 * мультидомена разметка ссылается на свой хост.
 */

export type Crumb = { url?: string | null; label?: string | null }

/** https://<домен> без завершающего слэша; '' если домена нет. */
export function siteBaseUrl(domain?: string | null): string {
  const d = (domain || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  return d ? `https://${d}` : ''
}

/** Обрезать заголовок для headline (Google рекомендует ≤110 символов). */
function clampHeadline(s: string, max = 110): string {
  const t = (s || '').trim()
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}

function toIso(value?: string | Date | null): string | undefined {
  if (!value) return undefined
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

/** Organization — единый узел-эмитент (@id используется как publisher везде). */
export function organizationJsonLd(opts: {
  domain?: string | null
  name?: string | null
  logoUrl?: string | null
}): object | null {
  const base = siteBaseUrl(opts.domain)
  if (!base) return null
  const name = (opts.name || '').trim() || base.replace('https://', '')
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${base}/#organization`,
    name,
    url: base,
    ...(opts.logoUrl ? { logo: { '@type': 'ImageObject', url: opts.logoUrl } } : {}),
  }
}

/** WebSite + SearchAction (поисковая строка сайта в выдаче — sitelinks searchbox). */
export function webSiteJsonLd(opts: {
  domain?: string | null
  name?: string | null
}): object | null {
  const base = siteBaseUrl(opts.domain)
  if (!base) return null
  const name = (opts.name || '').trim() || base.replace('https://', '')
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${base}/#website`,
    url: base,
    name,
    inLanguage: 'ru-RU',
    publisher: { '@id': `${base}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${base}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

/**
 * BreadcrumbList. Принимает крошки в том же виде, что и компонент Breadcrumbs:
 * «Главная» добавляется первой, ссылки на разделы строятся как /category<url>.
 * У крошки без url (текущая страница) ссылка не ставится — это валидно.
 */
export function breadcrumbJsonLd(opts: {
  domain?: string | null
  crumbs: Crumb[]
}): object | null {
  const base = siteBaseUrl(opts.domain)
  if (!base) return null
  const list: { name: string; url?: string }[] = [{ name: 'Главная', url: base }]
  for (const c of opts.crumbs || []) {
    const name = (c.label || '').trim()
    if (!name) continue
    list.push({ name, url: c.url ? `${base}/category${c.url}` : undefined })
  }
  if (list.length < 2) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: list.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      ...(it.url ? { item: it.url } : {}),
    })),
  }
}

/** Article / NewsArticle для публикации. isNews → NewsArticle. */
export function articleJsonLd(opts: {
  domain?: string | null
  brandName?: string | null
  logoUrl?: string | null
  slug: string
  title: string
  imageUrl?: string | null
  publishedAt?: string | Date | null
  updatedAt?: string | Date | null
  isNews?: boolean
}): object | null {
  const base = siteBaseUrl(opts.domain)
  if (!base || !opts.slug || !opts.title) return null
  const url = `${base}/publication/${opts.slug}`
  const brand = (opts.brandName || '').trim() || base.replace('https://', '')
  const published = toIso(opts.publishedAt)
  return {
    '@context': 'https://schema.org',
    '@type': opts.isNews ? 'NewsArticle' : 'Article',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: clampHeadline(opts.title),
    inLanguage: 'ru-RU',
    ...(opts.imageUrl ? { image: [opts.imageUrl] } : {}),
    ...(published ? { datePublished: published } : {}),
    ...(toIso(opts.updatedAt) ? { dateModified: toIso(opts.updatedAt) } : {}),
    author: { '@type': 'Organization', name: brand, url: base },
    publisher: {
      '@type': 'Organization',
      name: brand,
      ...(opts.logoUrl ? { logo: { '@type': 'ImageObject', url: opts.logoUrl } } : {}),
    },
  }
}

/** ISO-8601 длительность (PT#M#S) из секунд. */
function isoDuration(sec?: number | null): string | undefined {
  if (!sec || !Number.isFinite(sec) || sec <= 0) return undefined
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return `PT${h ? h + 'H' : ''}${m ? m + 'M' : ''}${r ? r + 'S' : ''}` || 'PT0S'
}

/** VideoObject для страницы видео. */
export function videoObjectJsonLd(opts: {
  domain?: string | null
  slug: string
  title: string
  description?: string | null
  thumbnailUrl?: string | null
  publishedAt?: string | Date | null
  durationSec?: number | null
}): object | null {
  const base = siteBaseUrl(opts.domain)
  if (!base || !opts.slug || !opts.title) return null
  const url = `${base}/video/${opts.slug}`
  const uploaded = toIso(opts.publishedAt)
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    '@id': `${url}#video`,
    name: opts.title,
    description: (opts.description || '').trim() || opts.title,
    inLanguage: 'ru-RU',
    ...(opts.thumbnailUrl ? { thumbnailUrl: [opts.thumbnailUrl] } : {}),
    // uploadDate обязателен для VideoObject — подставляем дату публикации,
    // иначе Google считает разметку неполной и не показывает rich-результат.
    uploadDate: uploaded || new Date().toISOString(),
    ...(isoDuration(opts.durationSec) ? { duration: isoDuration(opts.durationSec) } : {}),
    contentUrl: url,
  }
}

/**
 * Artist (участник или группа) для страницы-хаба. Person для участника,
 * MusicGroup для группы. sameAs связывает сущность с её авторитетной
 * страницей (Wikipedia) — помогает поиску однозначно опознать артиста
 * (важно против омонимов «джин», «шуга»).
 */
export function artistJsonLd(opts: {
  domain?: string | null
  slug: string
  pageUrl?: string | null
  imageUrl?: string | null
  identity: {
    type: 'person' | 'group'
    name: string
    alternateName?: string[]
    sameAs?: string[]
    roleName?: string
  }
}): object | null {
  const base = siteBaseUrl(opts.domain)
  const id = opts.identity
  if (!base || !id?.name) return null
  const common = {
    '@context': 'https://schema.org',
    '@id': `${base}/#artist-${opts.slug}`,
    name: id.name,
    url: opts.pageUrl || base,
    ...(id.alternateName && id.alternateName.length ? { alternateName: id.alternateName } : {}),
    ...(id.sameAs && id.sameAs.length ? { sameAs: id.sameAs } : {}),
    ...(opts.imageUrl ? { image: opts.imageUrl } : {}),
    ...(opts.pageUrl ? { mainEntityOfPage: opts.pageUrl } : {}),
  }
  if (id.type === 'group') {
    return { ...common, '@type': 'MusicGroup' }
  }
  return {
    ...common,
    '@type': 'Person',
    ...(id.roleName ? { jobTitle: id.roleName } : {}),
    memberOf: { '@type': 'MusicGroup', name: 'BTS', sameAs: 'https://en.wikipedia.org/wiki/BTS' },
  }
}
