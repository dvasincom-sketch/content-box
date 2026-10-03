import { seoBrandForDomain } from './seoBrand'
import { truncateAtWord } from '@/utils/lexicalText'

/**
 * Авто-SEO-описание «из контекста самой страницы» — для категорий/публикаций
 * без заполненного seo.description. Используется и в рантайме (фолбэк в
 * generateMetadata), и в разовом бэкфилле (scripts/backfill-seo.ts), чтобы
 * сгенерированное и отданное поисковику описание совпадали.
 *
 * Логика:
 *  1) если у страницы есть осмысленный текст тела (>= DESC_MIN) — берём его
 *     (обрезая по слову до DESC_MAX): это самое релевантное описание;
 *  2) иначе собираем из контекста: заголовок (fullTitle/title) + целевой запрос
 *     + бренд. Для btsrussia.ru — с формулировками «на русском, с переводом и
 *     озвучкой»; уникальность даёт заголовок (у каждой страницы свой).
 */
export const SEO_DESC_MIN = 50
export const SEO_DESC_MAX = 160

export function autoSeoDescription(opts: {
  domain?: string | null
  /** Готовый plain-text тела страницы (напр. extractLexicalText(description)). */
  bodyText?: string | null
  /** Ведущий заголовок: fullTitle для категории, title для публикации. */
  leadTitle?: string | null
  /** Целевые запросы (первый вплетаем в шаблон). */
  keywords?: string[] | null
  flavor?: 'category' | 'publication'
  /** Тип контента раздела для публикаций: «Weverse Live», «интервью» и т.п. */
  intent?: string | null
}): string {
  const body = String(opts.bodyText || '').replace(/\s+/g, ' ').trim()
  if (body.length >= SEO_DESC_MIN) return truncateAtWord(body, SEO_DESC_MAX)

  const brand = seoBrandForDomain(opts.domain)
  const lead = String(opts.leadTitle || '').replace(/\s+/g, ' ').trim()
  const kw = (opts.keywords || []).map((k) => String(k || '').trim()).filter(Boolean)[0]

  // Разбираем иерархию из fullTitle «Родитель > Подраздел > Лист»: лист — тема
  // описания, верхний родитель даёт контекст («влоги», «биография» и т.п.).
  const segs = lead.split('>').map((x) => x.trim()).filter(Boolean)
  const leaf = segs.length ? segs[segs.length - 1] : lead
  const parent = segs.length > 1 ? segs[0] : ''
  const parentLow = parent ? parent.toLowerCase() : ''

  let s = ''
  if (opts.flavor === 'publication') {
    const intent = String(opts.intent || '').trim()
    s = brand
      ? intent
        ? `${leaf} — ${intent} на русском с переводом и озвучкой. Смотрите BTS на русском.`
        : `${leaf} — на русском с переводом и озвучкой. Смотрите BTS на русском.`
      : `${leaf} — ${intent ? intent + ', ' : ''}видео и материалы на сайте.`
  } else if (brand) {
    // Раздел брендового сайта (btsrussia): естественное предложение с контекстом.
    if (parentLow) {
      s = `${leaf} — ${parentLow} BTS на русском с переводом и озвучкой. Смотрите на btsrussia.ru.`
    } else if (kw) {
      s = `${leaf} на русском — ${kw}, видео и материалы BTS с переводом и озвучкой.`
    } else {
      s = `${leaf} — BTS на русском: видео, публикации и материалы с переводом и озвучкой.`
    }
  } else {
    // Небрендированный тенант: тоже полноценное описание, а не просто заголовок.
    s = parentLow
      ? `${leaf} — ${parentLow}: видео, публикации и материалы раздела на сайте.`
      : `${leaf} — видео, публикации и материалы раздела на сайте проекта.`
  }

  s = s.replace(/\s+/g, ' ').trim()
  // Страховка от слишком короткого описания (< SEO_DESC_MIN): добавляем хвост.
  if (s && s.length < SEO_DESC_MIN) {
    const tail = brand ? ' Смотрите на русском с переводом и озвучкой.' : ' Смотрите на сайте проекта.'
    s = (s.replace(/\.*$/, '') + ' —' + tail).replace(/\s+/g, ' ').trim()
  }
  if (s.length > SEO_DESC_MAX) s = truncateAtWord(s, SEO_DESC_MAX)
  return s
}

/** Тип контента раздела → слово для описания публикации (по slug категории). */
export const PUB_INTENT_BY_SLUG: Record<string, string> = {
  'weverse-live': 'Weverse Live',
  interviews: 'интервью',
  concerts: 'концерт',
  vlogs: 'влог',
  shows: 'шоу',
  docs: 'документальное видео',
  backstage: 'видео за кадром',
  audiobooks: 'аудиокнига',
}
