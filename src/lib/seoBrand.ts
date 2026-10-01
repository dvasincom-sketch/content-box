/**
 * Хардкод SEO-бренда под конкретные домены (усиление title).
 *
 * Пока единственный «брендированный» тенант — btsrussia.ru (COCO JAMBO):
 * у него свой заголовок главной, свой суффикс бренда для внутренних страниц и
 * список разделов, где в SEO-title публикации добавляется дата. Для остальных
 * тенантов функция возвращает null — их SEO работает по общему каскаду без
 * изменений.
 *
 * Здесь же — единая точка для ключевых фраз (целевых запросов), если позже
 * понадобится раздавать их по страницам в коде.
 */

export interface SeoBrand {
  /** Полный <title> главной страницы. */
  homeTitle: string
  /** Суффикс бренда для внутренних страниц: «{заголовок} | {suffix}». */
  suffix: string
  /** Slug'и разделов, где в SEO-title публикации добавляется дата публикации. */
  dateCategorySlugs: string[]
}

/** Keyword-усиленный SEO раздела (участника). */
export interface MemberSeo {
  /** Готовый <title> раздела (суффикс бренда уже внутри). */
  title: string
  /** Meta description раздела. */
  description: string
  /** Целевые запросы (meta keywords). */
  keywords: string[]
}

/**
 * Целевые запросы разделов участников (ТЗ §2). Ключ верхнего уровня — домен,
 * ключ второго — slug раздела (/category/world/members/<slug>).
 * Пока заполнены участники, по которым переданы фразы: Чонгук, Тэхён, Чимин.
 */
const MEMBERS: Record<string, Record<string, MemberSeo>> = {
  'btsrussia.ru': {
    'jung-kook': {
      title: 'Чонгук на русском — Weverse Live, эфиры, интервью | BTS на русском',
      description:
        'Чонгук (Jungkook): Weverse Live с переводом, эфиры и интервью на русском, видео с озвучкой. Смотрите лайвы Чонгука BTS на русском языке.',
      keywords: [
        'Чонгук Weverse Live перевод',
        'Чонгук эфир на русском',
        'Чонгук лайв на русском',
        'Jungkook Weverse Live',
        'Чонгук интервью на русском',
        'Чонгук видео на русском',
        'Чонгук на русском',
      ],
    },
    v: {
      title: 'Тэхён на русском — Weverse Live, эфиры, интервью | BTS на русском',
      description:
        'Тэхён (V, Taehyung): Weverse Live с переводом, эфиры и интервью на русском. Смотрите лайвы Тэхёна BTS на русском языке с озвучкой.',
      keywords: [
        'Тэхён Weverse Live перевод',
        'Тэхён эфир на русском',
        'Taehyung live русский перевод',
        'V BTS на русском',
        'Тэхён интервью на русском',
        'Тэхён на русском',
      ],
    },
    jimin: {
      title: 'Чимин на русском — Weverse Live, эфиры, интервью | BTS на русском',
      description:
        'Чимин (Jimin): Weverse Live с переводом, эфиры и интервью на русском. Лайвы Чимина BTS и совместные эфиры на русском языке с озвучкой.',
      keywords: [
        'Чимин Weverse Live перевод',
        'Jimin live на русском',
        'Чимин интервью русский перевод',
        'Чимин и Чонгук на русском',
        'Чимин на русском',
      ],
    },
  },
}

const BRANDS: Record<string, SeoBrand> = {
  'btsrussia.ru': {
    homeTitle: 'BTS на русском — смотреть с переводом и озвучкой | COCO JAMBO Озвучка',
    suffix: 'BTS на русском',
    dateCategorySlugs: ['weverse-live'],
  },
}

/** Нормализуем домен: нижний регистр, без www. и порта. */
function normDomain(domain?: string | null): string {
  return (domain || '')
    .toLowerCase()
    .replace(/^www\./, '')
    .split(':')[0]
    .trim()
}

/** SEO-бренд для домена тенанта (null — обычный каскад без хардкода). */
export function seoBrandForDomain(domain?: string | null): SeoBrand | null {
  return BRANDS[normDomain(domain)] || null
}

/** Keyword-усиленный SEO раздела участника (null — обычный раздел). */
export function memberSeoForDomain(domain?: string | null, slug?: string | null): MemberSeo | null {
  const byDomain = MEMBERS[normDomain(domain)]
  if (!byDomain) return null
  return byDomain[(slug || '').trim()] || null
}

/** Дата публикации по-русски: «12 сентября 2026 г.» (часовой пояс МСК). */
export function formatPublishedRu(value?: string | Date | null): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Moscow',
    }).format(d)
  } catch {
    return ''
  }
}

/**
 * Собрать SEO-title внутренней страницы из частей:
 *   «{заголовок} | {дата?} | {suffix}» — пустые части отбрасываются.
 */
export function composeBrandTitle(parts: Array<string | null | undefined>): string {
  return parts.map((p) => (p || '').trim()).filter(Boolean).join(' | ')
}
