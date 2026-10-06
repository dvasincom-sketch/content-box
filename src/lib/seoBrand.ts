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
    rm: {
      title: 'Намджун на русском — Weverse Live, эфиры, интервью | BTS на русском',
      description:
        'Намджун (RM): Weverse Live с переводом, эфиры и интервью на русском. Смотрите лайвы лидера BTS на русском языке с озвучкой.',
      keywords: [
        'Намджун Weverse Live перевод',
        'RM эфир на русском',
        'Намджун интервью на русском',
        'RM BTS на русском',
        'Намджун на русском',
      ],
    },
    jin: {
      title: 'Чин на русском — Weverse Live, эфиры, интервью | BTS на русском',
      description:
        'Чин (Jin): Weverse Live с переводом, эфиры и интервью на русском. Смотрите лайвы Чина BTS на русском языке с озвучкой.',
      keywords: [
        'Чин Weverse Live перевод',
        'Jin эфир на русском',
        'Чин интервью на русском',
        'Jin BTS на русском',
        'Чин на русском',
      ],
    },
    suga: {
      title: 'Шуга на русском — Weverse Live, эфиры, интервью | BTS на русском',
      description:
        'Шуга (Suga, Agust D): Weverse Live с переводом, эфиры и интервью на русском. Смотрите лайвы Юнги на русском языке с озвучкой.',
      keywords: [
        'Шуга Weverse Live перевод',
        'Suga эфир на русском',
        'Юнги интервью на русском',
        'Agust D на русском',
        'Шуга на русском',
      ],
    },
    'j-hope': {
      title: 'Джей-Хоуп на русском — Weverse Live, эфиры, интервью | BTS на русском',
      description:
        'Джей-Хоуп (J-Hope): Weverse Live с переводом, эфиры и интервью на русском. Смотрите лайвы Хосока BTS на русском языке с озвучкой.',
      keywords: [
        'Джей-Хоуп Weverse Live перевод',
        'J-Hope эфир на русском',
        'Хосок интервью на русском',
        'J-Hope BTS на русском',
        'Джей-Хоуп на русском',
      ],
    },
    bts: {
      title: 'BTS — совместные эфиры и интервью на русском | BTS на русском',
      description:
        'BTS: совместные Weverse Live с переводом, групповые эфиры и интервью на русском, видео с озвучкой. Смотрите BTS на русском языке.',
      keywords: [
        'BTS Weverse Live перевод',
        'BTS эфир на русском',
        'BTS интервью на русском',
        'BTS видео на русском',
        'BTS на русском озвучка',
      ],
    },
  },
}

/**
 * Keyword-усиленный SEO разделов «Смотреть» (/category/watch/<slug>).
 * Готовый title (суффикс бренда уже внутри) + description + целевые запросы.
 */
const SECTIONS: Record<string, Record<string, MemberSeo>> = {
  'btsrussia.ru': {
    'weverse-live': {
      title: 'Weverse Live BTS — эфиры с переводом и озвучкой | BTS на русском',
      description:
        'Weverse Live BTS на русском: прямые эфиры участников с переводом и озвучкой, записи лайвов. Смотрите Weverse Live BTS на русском языке.',
      keywords: [
        'Weverse Live BTS на русском',
        'Weverse Live перевод',
        'BTS эфиры на русском',
        'BTS лайв с озвучкой',
      ],
    },
    interviews: {
      title: 'Интервью и гостевые шоу BTS с переводом | BTS на русском',
      description:
        'Интервью и гостевые шоу BTS на русском: переводы и озвучка выступлений участников. Смотрите интервью BTS на русском языке.',
      keywords: [
        'интервью BTS на русском',
        'BTS гостевые шоу перевод',
        'BTS интервью с озвучкой',
      ],
    },
    concerts: {
      title: 'Концерты BTS — записи выступлений на русском | BTS на русском',
      description:
        'Концерты BTS на русском: записи выступлений и туров с переводом и озвучкой. Смотрите концерты BTS на русском языке.',
      keywords: ['концерты BTS на русском', 'BTS выступления перевод', 'BTS концерт с озвучкой'],
    },
    vlogs: {
      title: 'Влоги и дневники BTS с озвучкой | BTS на русском',
      description:
        'Влоги и дневники участников BTS на русском: личные видео с переводом и озвучкой. Смотрите влоги BTS на русском языке.',
      keywords: ['влоги BTS на русском', 'дневники BTS перевод', 'BTS влог с озвучкой'],
    },
    shows: {
      title: 'Шоу и проекты BTS с переводом и озвучкой | BTS на русском',
      description:
        'Шоу и проекты BTS на русском: Run BTS и другие шоу с переводом и озвучкой. Смотрите шоу BTS на русском языке.',
      keywords: ['шоу BTS на русском', 'Run BTS на русском', 'BTS проекты перевод'],
    },
    docs: {
      title: 'Документальные фильмы BTS на русском | BTS на русском',
      description:
        'Документальные фильмы и сериалы BTS на русском: истории группы с переводом и озвучкой. Смотрите документалки BTS на русском языке.',
      keywords: ['документальные фильмы BTS на русском', 'BTS сериалы перевод', 'BTS документалка'],
    },
    new: {
      title: 'Новинки BTS — свежие видео с озвучкой | BTS на русском',
      description:
        'Новинки BTS на русском: свежие эфиры, видео и переводы с озвучкой. Смотрите новые видео BTS на русском языке.',
      keywords: ['новинки BTS на русском', 'новые видео BTS перевод', 'BTS свежее с озвучкой'],
    },
    backstage: {
      title: 'BTS за кадром — закулисье с переводом | BTS на русском',
      description:
        'BTS за кадром на русском: закулисье, бэкстейдж и редкие кадры с переводом и озвучкой. Смотрите BTS за кадром на русском языке.',
      keywords: ['BTS за кадром на русском', 'BTS бэкстейдж перевод', 'BTS закулисье с озвучкой'],
    },
    'special-editions': {
      title: 'Специальные издания BTS на русском | BTS на русском',
      description:
        'Специальные издания BTS на русском: эксклюзивные выпуски и материалы с переводом и озвучкой. Смотрите спецвыпуски BTS на русском языке.',
      keywords: ['специальные издания BTS на русском', 'BTS спецвыпуски перевод'],
    },
    audiobooks: {
      title: 'Аудиокниги BTS на русском — слушать онлайн | BTS на русском',
      description:
        'Аудиокниги BTS на русском: озвученные истории и книги о группе. Слушайте аудиокниги BTS на русском языке онлайн.',
      keywords: ['аудиокниги BTS на русском', 'BTS книги озвучка', 'слушать BTS на русском'],
    },
    members: {
      title: 'Участники BTS — сольные эфиры и видео на русском | BTS на русском',
      description:
        'Участники BTS на русском: сольные Weverse Live, эфиры и видео каждого участника с переводом и озвучкой. Смотрите на русском языке.',
      keywords: ['участники BTS на русском', 'сольные эфиры BTS перевод', 'BTS по участникам'],
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

/** Keyword-усиленный SEO раздела «Смотреть» (null — обычный раздел). */
export function sectionSeoForDomain(domain?: string | null, slug?: string | null): MemberSeo | null {
  const byDomain = SECTIONS[normDomain(domain)]
  if (!byDomain) return null
  return byDomain[(slug || '').trim()] || null
}

/** Любой keyword-пресет раздела: участник или раздел «Смотреть». */
export function presetSeoForDomain(domain?: string | null, slug?: string | null): MemberSeo | null {
  return memberSeoForDomain(domain, slug) || sectionSeoForDomain(domain, slug)
}

/** Максимальная длина <title> (симв.): дальше поисковики обрезают выдачу. */
export const SEO_TITLE_MAX = 70

/** Обрезать строку по границе слова до maxLen символов (без «…»). */
function trimAtWord(text: string, maxLen: number): string {
  const s = (text || '').trim()
  if (s.length <= maxLen) return s
  const cut = s.slice(0, maxLen)
  const sp = cut.lastIndexOf(' ')
  return (sp > 0 ? cut.slice(0, sp) : cut).replace(/[\s—–-]+$/, '').trim()
}

/**
 * Собрать «{лид} | {суффикс}» с учётом длины: если не влезает в SEO_TITLE_MAX —
 * лид обрезается по слову. Если суффикса нет — просто обрезанный лид.
 */
export function clampBrandTitle(lead: string, suffix?: string | null, max = SEO_TITLE_MAX): string {
  const tail = (suffix || '').trim()
  const sep = ' | '
  if (!tail) return trimAtWord(lead, max)
  const room = max - tail.length - sep.length
  if (room <= 0) return trimAtWord(lead, max) // суффикс сам длиннее лимита — без него
  const head = trimAtWord(lead, room)
  return head ? `${head}${sep}${tail}` : tail
}

/**
 * Title внутренней страницы для брендированного домена: «{лид} | BTS на русском»
 * с обрезкой по длине. null — домен не брендирован (используйте прежнюю логику).
 */
export function brandPageTitle(domain: string | null | undefined, lead: string, max = SEO_TITLE_MAX): string | null {
  const brand = seoBrandForDomain(domain)
  if (!brand) return null
  return clampBrandTitle(lead, brand.suffix, max)
}

/**
 * Авто-описание публикации по типу раздела (ключи — в description, не в title):
 *   «{название} — {интент раздела} на русском с переводом и озвучкой.»
 */
export function pubAutoDescription(domain: string | null | undefined, title: string, catSlug?: string | null): string | null {
  if (!seoBrandForDomain(domain)) return null
  const t = (title || '').trim()
  if (!t) return null
  const INTENT: Record<string, string> = {
    'weverse-live': 'Weverse Live',
    interviews: 'интервью',
    concerts: 'концерт',
    vlogs: 'влог',
    shows: 'шоу',
    docs: 'документальное видео',
    backstage: 'видео за кадром',
    audiobooks: 'аудиокнига',
    new: 'новинка',
    'special-editions': 'спецвыпуск',
    members: 'видео участника',
  }
  const intent = INTENT[(catSlug || '').trim()]
  const lead = intent ? `${t} — ${intent} на русском` : `${t} — на русском`
  return `${lead} с переводом и озвучкой. Смотрите BTS на русском языке.`
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

/** Идентичность артиста для микроразметки хаба (Person / MusicGroup). */
export interface ArtistIdentity {
  type: 'person' | 'group'
  /** Отображаемое имя (на русском). */
  name: string
  /** Альтернативные написания: латиница, корейское имя, транслит. */
  alternateName: string[]
  /** Авторитетные ссылки (Wikipedia и т.п.) — sameAs для однозначного опознания. */
  sameAs: string[]
  /** Роль в группе (jobTitle) — только для участника. */
  roleName?: string
}

/**
 * Карта «домен → slug категории участника → идентичность». Ключи slug'ов
 * совпадают с ключами MEMBERS (категории /category/.../<slug>). Используется,
 * чтобы на странице-категории участника отдать Person/MusicGroup-разметку.
 */
const ARTISTS: Record<string, Record<string, ArtistIdentity>> = {
  'btsrussia.ru': {
    'jung-kook': { type: 'person', name: 'Чонгук', alternateName: ['Jungkook', 'Jeon Jung-kook', 'Чон Чонгук', '전정국'], sameAs: ['https://en.wikipedia.org/wiki/Jungkook'], roleName: 'Вокалист BTS' },
    v: { type: 'person', name: 'Ви (Тэхён)', alternateName: ['V', 'Kim Tae-hyung', 'Тэхён', 'Ким Тэхён', '김태형'], sameAs: ['https://en.wikipedia.org/wiki/V_(singer)'], roleName: 'Вокалист BTS' },
    jimin: { type: 'person', name: 'Чимин', alternateName: ['Jimin', 'Park Ji-min', 'Пак Чимин', '박지민'], sameAs: ['https://en.wikipedia.org/wiki/Jimin'], roleName: 'Вокалист BTS' },
    rm: { type: 'person', name: 'RM (Намджун)', alternateName: ['RM', 'Kim Nam-joon', 'Намджун', 'Ким Намджун', '김남준'], sameAs: ['https://en.wikipedia.org/wiki/RM_(musician)'], roleName: 'Лидер и рэпер BTS' },
    jin: { type: 'person', name: 'Джин (Сокджин)', alternateName: ['Jin', 'Kim Seok-jin', 'Сокджин', 'Ким Сокджин', '김석진'], sameAs: ['https://en.wikipedia.org/wiki/Jin_(singer)'], roleName: 'Вокалист BTS' },
    suga: { type: 'person', name: 'Шуга (Юнги)', alternateName: ['Suga', 'Agust D', 'Min Yoon-gi', 'Юнги', 'Мин Юнги', '민윤기'], sameAs: ['https://en.wikipedia.org/wiki/Suga_(rapper)'], roleName: 'Рэпер BTS' },
    'j-hope': { type: 'person', name: 'Джей-Хоуп', alternateName: ['j-hope', 'Jung Ho-seok', 'Хосок', 'Чон Хосок', '정호석'], sameAs: ['https://en.wikipedia.org/wiki/J-Hope'], roleName: 'Рэпер и танцор BTS' },
    bts: { type: 'group', name: 'BTS', alternateName: ['Bangtan Boys', 'Бантан Сонёндан', 'БТС', '방탄소년단'], sameAs: ['https://en.wikipedia.org/wiki/BTS'] },
  },
}

/** Идентичность артиста по домену и slug категории (null — не артист-хаб). */
export function artistIdentityForDomain(domain?: string | null, slug?: string | null): ArtistIdentity | null {
  const byDomain = ARTISTS[normDomain(domain)]
  if (!byDomain) return null
  return byDomain[(slug || '').trim()] || null
}
