import type { HomeSectionType, HomeSectionSettings } from '@/lib/homeSections'

/**
 * Паки (шаблоны) главной страницы — код-константы, как themePresets.ts.
 *
 * Три сценария по тому, ЧТО делает аудитория у автора: смотреть / слушать /
 * читать. Пак ориентирован на тип автора и его читателей и собирает главную
 * целиком:
 *   - themePreset — id пресета оформления (см. themePresets.ts);
 *   - sections    — порядок, видимость и ПЕР-СЕКЦИОННЫЙ config (заголовок и др.)
 *                   существующих секций (HomeSectionType);
 *   - content     — стартовые тексты редактируемых секций (hero, banner).
 *
 * Секции с данными (категории, ленты, постеры, карусели) тянут реальный контент
 * тенанта — пак не создаёт публикаций; на пустом проекте они авто-скрыты.
 * Заголовки списочных секций пак задаёт под сценарий через config.heading
 * («Новые серии/выпуски/главы», «Сейчас смотрят/слушают/читают»).
 *
 * Добавить пак = одна запись в HOME_PACKS. Применение — роут apply-pack.
 */

export interface HomePackContent {
  hero?: { eyebrow?: string; titleLines?: string }
  banner?: { tagline?: string; onAirText?: string }
}

/** Одна секция пака: тип + видимость + опциональные пер-секционные настройки. */
export interface HomePackSection {
  type: HomeSectionType
  enabled: boolean
  config?: HomeSectionSettings
}

export interface HomePack {
  id: string
  /** Витринное имя-существительное (Видео/Аудио/Тексты/Магазин). */
  name: string
  /** Глагол-действие посетителя — подпись внутри шаблона (Смотреть/Слушать/…). */
  verb: string
  description: string
  /** id пресета оформления; при применении валидируется по реестру пресетов. */
  themePreset: string
  /** Порядок + видимость + config секций (только существующие HomeSectionType). */
  sections: HomePackSection[]
  /** Стартовые тексты редактируемых секций (мягко мержатся в существующие). */
  content?: HomePackContent
}

export const HOME_PACKS: HomePack[] = [
  {
    id: 'watch',
    name: 'Видео',
    verb: 'Смотреть',
    description:
      'Для видеоавторов и студий: афиши, новинки и прямые эфиры. Зрителям — удобная витрина и быстрый доступ к сериям.',
    themePreset: 'neon-dawn',
    sections: [
      { type: 'hero', enabled: true },
      { type: 'search', enabled: true },
      { type: 'posterRows', enabled: true },
      { type: 'latest', enabled: true, config: { heading: 'Новые серии' } },
      { type: 'popular', enabled: true, config: { heading: 'Сейчас смотрят' } },
      { type: 'posterGrid', enabled: true, config: { heading: 'Афиша' } },
      { type: 'broadcast', enabled: true },
      { type: 'authorSpotlight', enabled: true },
      { type: 'socials', enabled: true },
    ],
    content: {
      hero: { eyebrow: 'Новинка', titleLines: 'Смотри\nистории' },
      banner: { tagline: 'Прямые эфиры по расписанию', onAirText: 'В ЭФИРЕ' },
    },
  },
  {
    id: 'listen',
    name: 'Аудио',
    verb: 'Слушать',
    description:
      'Для аудиоавторов — озвучка, подкасты, музыка: подборки по жанрам, свежие выпуски и эфиры. Слушателям — ничего не потерять.',
    themePreset: 'amber-pulse',
    sections: [
      { type: 'hero', enabled: true },
      { type: 'search', enabled: true },
      { type: 'carousel', enabled: true, config: { heading: 'Подборки по жанрам' } },
      { type: 'latest', enabled: true, config: { heading: 'Новые выпуски' } },
      { type: 'popular', enabled: true, config: { heading: 'Сейчас слушают' } },
      { type: 'categories', enabled: true },
      { type: 'broadcast', enabled: true },
      { type: 'authorSpotlight', enabled: true },
      { type: 'socials', enabled: true },
    ],
    content: {
      hero: { eyebrow: 'Аудио', titleLines: 'Слушай\nистории' },
      banner: { tagline: 'Живые эфиры по вечерам', onAirText: 'В ЭФИРЕ' },
    },
  },
  {
    id: 'read',
    name: 'Тексты',
    verb: 'Читать',
    description:
      'Для писателей и авторов текстов: каталог книг и циклов, новинки и разделы. Читателям — тёплая витрина и удобная навигация.',
    themePreset: 'velvet-resonance',
    sections: [
      { type: 'hero', enabled: true },
      { type: 'search', enabled: true },
      { type: 'latest', enabled: true, config: { heading: 'Новые главы' } },
      { type: 'categories', enabled: true },
      { type: 'popularCategories', enabled: true },
      { type: 'popular', enabled: true, config: { heading: 'Сейчас читают' } },
      { type: 'authorSpotlight', enabled: true },
      { type: 'whyUs', enabled: true },
      { type: 'socials', enabled: true },
    ],
    content: {
      hero: { eyebrow: 'Новинка', titleLines: 'Читай\nистории' },
    },
  },
  {
    id: 'sell',
    name: 'Магазин',
    verb: 'Покупать',
    description:
      'Для авторов цифровых товаров — пресеты, гайды, шаблоны, файлы: витрина, новинки и продажа доступа.',
    themePreset: 'digital-monolith',
    sections: [
      { type: 'hero', enabled: true },
      { type: 'search', enabled: true },
      { type: 'categories', enabled: true },
      { type: 'posterGrid', enabled: true, config: { heading: 'Витрина' } },
      { type: 'latest', enabled: true, config: { heading: 'Новинки' } },
      { type: 'popular', enabled: true, config: { heading: 'Часто покупают' } },
      { type: 'authorSpotlight', enabled: true },
      { type: 'whyUs', enabled: true },
      { type: 'socials', enabled: true },
    ],
    content: {
      hero: { eyebrow: 'Магазин', titleLines: 'Цифровые\nтовары' },
    },
  },
]

/** Пользовательский сохранённый шаблон (пер-тенант, хранится в SiteSettings.savedTemplates). */
export interface HomeSavedTemplate {
  id: string
  name: string
  themePreset: string
  sections: HomePackSection[]
  content?: HomePackContent
}

/** Все id паков (для валидации в роуте). */
export const HOME_PACK_IDS: string[] = HOME_PACKS.map((p) => p.id)

/** Пак по id либо undefined. */
export function getHomePack(id: string): HomePack | undefined {
  return HOME_PACKS.find((p) => p.id === id)
}
