import type { HomeSectionType } from '@/lib/homeSections'

/**
 * Паки (шаблоны) главной страницы — код-константы, как themePresets.ts.
 *
 * Пак собирает главную «под нишу» на ТЕКУЩЕЙ модели:
 *   - themePreset — id пресета оформления (см. themePresets.ts);
 *   - sections    — порядок и видимость СУЩЕСТВУЮЩИХ секций (HomeSectionType);
 *   - content     — стартовые ТЕКСТЫ для редактируемых секций (hero, banner).
 *
 * Секции с данными (категории, ленты, постеры) тянут реальный контент тенанта —
 * пак не создаёт публикаций. Заголовки секций на текущей модели фиксированы в
 * page.tsx (переопределение заголовков — задача следующей, «глубокой» фазы).
 *
 * Добавить пак = одна запись в HOME_PACKS. Применение — роут apply-pack.
 */

export interface HomePackContent {
  hero?: { eyebrow?: string; titleLines?: string }
  banner?: { tagline?: string; onAirText?: string }
}

export interface HomePack {
  id: string
  name: string
  description: string
  /** id пресета оформления; при применении валидируется по реестру пресетов. */
  themePreset: string
  /** Порядок + видимость секций (только существующие HomeSectionType). */
  sections: { type: HomeSectionType; enabled: boolean }[]
  /** Стартовые тексты редактируемых секций (мягко мержатся в существующие). */
  content?: HomePackContent
}

export const HOME_PACKS: HomePack[] = [
  {
    id: 'author-books',
    name: 'Автор / книги',
    description:
      'Каталог книг и циклов: новинки, жанры, «почему мы». Тёплая тема для чтения.',
    themePreset: 'velvet-resonance',
    sections: [
      { type: 'hero', enabled: true },
      { type: 'search', enabled: true },
      { type: 'latest', enabled: true },
      { type: 'categories', enabled: true },
      { type: 'popularCategories', enabled: true },
      { type: 'popular', enabled: true },
      { type: 'whyUs', enabled: true },
      { type: 'socials', enabled: true },
    ],
    content: {
      hero: { eyebrow: 'Новинка', titleLines: 'Книги\nи истории' },
    },
  },
  {
    id: 'media-audio',
    name: 'Медиа / озвучка',
    description:
      'Аудио-платформа: разделы-афиши, карусели по жанрам, новинки и эфиры. Неоновая тема.',
    themePreset: 'neon-dawn',
    sections: [
      { type: 'hero', enabled: true },
      { type: 'categories', enabled: true },
      { type: 'posterRows', enabled: true },
      { type: 'latest', enabled: true },
      { type: 'popular', enabled: true },
      { type: 'broadcast', enabled: true },
      { type: 'socials', enabled: true },
    ],
    content: {
      hero: { eyebrow: 'Озвучка', titleLines: 'Слушай\nистории' },
      banner: { tagline: 'Прямые эфиры по вечерам', onAirText: 'В ЭФИРЕ' },
    },
  },
]

/** Все id паков (для валидации в роуте). */
export const HOME_PACK_IDS: string[] = HOME_PACKS.map((p) => p.id)

/** Пак по id либо undefined. */
export function getHomePack(id: string): HomePack | undefined {
  return HOME_PACKS.find((p) => p.id === id)
}
