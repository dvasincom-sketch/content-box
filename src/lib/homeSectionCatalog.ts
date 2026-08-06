/**
 * Каталог секций главной для «Библиотеки секций» (окно выбора с превью).
 *
 * Отдельный слой метаданных ПОВЕРХ HOME_SECTION_DEFS: описание, что секция
 * умеет (чипы-возможности), группа и архетип скелет-превью. Здесь перечислены
 * и уже реализованные секции, и запланированные — чтобы владелец видел весь
 * набор и «дорожную карту» визуально.
 *
 * Статус вычисляется автоматически: секция «доступна» (available), если её type
 * есть в HOME_SECTION_TYPES (т.е. реально рендерится и добавляется). Как только
 * новая секция появляется в HOME_SECTION_DEFS — её карточка в библиотеке сама
 * становится добавляемой, метаданные править не нужно.
 */

import { HOME_SECTION_TYPES } from './homeSections'

/** Группы-вкладки в библиотеке (совпадают с кластерами из брифа). */
export type SectionGroup = 'Автор' | 'Ленты' | 'Медиа' | 'Сообщество' | 'Промо' | 'Инфо'
export const SECTION_GROUPS: readonly SectionGroup[] = [
  'Автор',
  'Ленты',
  'Медиа',
  'Сообщество',
  'Промо',
  'Инфо',
]

/** Архетип скелет-превью (как рисуется миниатюра раскладки секции). */
export type SectionPreview =
  | 'hero'
  | 'spotlight'
  | 'avatars'
  | 'rowcards'
  | 'posters'
  | 'grid'
  | 'listcards'
  | 'chart'
  | 'banner'
  | 'search'
  | 'chips'
  | 'features'
  | 'faq'
  | 'quotes'
  | 'tiers'
  | 'rows'
  | 'progress'
  | 'poll'

/** Статус секции в библиотеке. */
export type SectionStatus = 'available' | 'soon'

/** Одна карточка каталога. */
export interface SectionCatalogEntry {
  /** Машинный type секции (совпадает с HomeSectionType для available). */
  type: string
  title: string
  group: SectionGroup
  description: string
  /** Короткие «умения» секции — чипы под описанием. */
  capabilities: string[]
  preview: SectionPreview
}

/**
 * Сырой каталог. Порядок = порядок показа внутри группы «Все».
 * type для реализованных секций = реальный HomeSectionType.
 */
const RAW: SectionCatalogEntry[] = [
  // ── Автор ──
  { type: 'hero', title: 'Hero — заставка', group: 'Автор', description: 'Крупная витрина с новинкой или слоганом проекта.', capabilities: ['новинка/слоган', 'обложка'], preview: 'hero' },
  { type: 'authorSpotlight', title: 'Об авторе и подписка', group: 'Автор', description: 'Bio, статистика, соцсети и уровни подписки с CTA.', capabilities: ['данные: тенант', 'тарифы'], preview: 'spotlight' },
  { type: 'heroTeam', title: 'Участники', group: 'Автор', description: 'Ряд аватаров команды или героев проекта.', capabilities: ['ручной список'], preview: 'avatars' },

  // ── Ленты ──
  { type: 'latest', title: 'Последние публикации', group: 'Ленты', description: 'Свежие материалы списком карточек.', capabilities: ['источник: категория', 'лимит'], preview: 'listcards' },
  { type: 'news', title: 'Новости', group: 'Ленты', description: 'Лента новостей проекта карточками.', capabilities: ['источник: категория', 'лимит'], preview: 'listcards' },
  { type: 'popular', title: 'Сейчас популярно', group: 'Ленты', description: 'Материалы, набирающие просмотры.', capabilities: ['источник: категория', 'лимит'], preview: 'listcards' },
  { type: 'discussed', title: 'Обсуждаемое', group: 'Ленты', description: 'Публикации с активным обсуждением.', capabilities: ['источник: категория', 'лимит'], preview: 'listcards' },
  { type: 'continue', title: '«Продолжить»', group: 'Ленты', description: 'Продолжить смотреть, слушать или читать с места остановки.', capabilities: ['персональное', 'история'], preview: 'rowcards' },
  { type: 'top', title: 'Топ-чарт', group: 'Ленты', description: 'Нумерованный рейтинг за период.', capabilities: ['период: неделя/месяц'], preview: 'chart' },

  // ── Медиа ──
  { type: 'carousel', title: 'Карусель-подборка', group: 'Медиа', description: 'Один ряд под кураторский выбор материалов.', capabilities: ['источник: тег/категория/список', 'карусель'], preview: 'posters' },
  { type: 'posterGrid', title: 'Сетка афиш', group: 'Медиа', description: 'Постеры сеткой в пропорции 2:3.', capabilities: ['источник', 'сетка'], preview: 'grid' },
  { type: 'posterRows', title: 'Киноблоки (ряды)', group: 'Медиа', description: 'Авто-ряды постеров по категориям.', capabilities: ['авто'], preview: 'posters' },
  { type: 'categories', title: 'Категории плитками', group: 'Медиа', description: 'Плитки разделов с обложками.', capabilities: ['ручной список'], preview: 'grid' },
  { type: 'popularCategories', title: 'Популярные разделы', group: 'Медиа', description: 'Чипы самых посещаемых разделов.', capabilities: ['авто'], preview: 'chips' },
  { type: 'shelf', title: 'Полка / фонотека', group: 'Медиа', description: 'Работы со статусом и прогрессом прослушивания.', capabilities: ['статус', 'размер'], preview: 'grid' },

  // ── Сообщество ──
  { type: 'activity', title: 'Лента активности', group: 'Сообщество', description: 'Свежие комментарии, реакции и новинки.', capabilities: ['данные: активность'], preview: 'rows' },
  { type: 'topFans', title: 'Топ-фанаты', group: 'Сообщество', description: 'Лидерборд по репутации и активности.', capabilities: ['данные: репутация'], preview: 'chart' },
  { type: 'goals', title: 'Цели / прогресс', group: 'Сообщество', description: 'Прогресс к цели проекта (как у Patreon).', capabilities: ['настройка цели'], preview: 'progress' },
  { type: 'poll', title: 'Опрос', group: 'Сообщество', description: 'Голосование «что дальше» для аудитории.', capabilities: ['данные: опросы'], preview: 'poll' },
  { type: 'schedule', title: 'Афиша + отсчёт', group: 'Сообщество', description: 'Ближайшие эфиры и релизы с обратным отсчётом.', capabilities: ['данные: события'], preview: 'rows' },

  // ── Промо ──
  { type: 'broadcast', title: 'Баннер эфира', group: 'Промо', description: 'Плашка «ON AIR» с ссылкой на трансляцию.', capabilities: ['тексты', 'ссылка'], preview: 'banner' },
  { type: 'ctaSub', title: 'CTA подписка', group: 'Промо', description: 'Яркий призыв оформить подписку с тарифами.', capabilities: ['данные: тарифы'], preview: 'tiers' },
  { type: 'chatCta', title: 'Кнопка в чат', group: 'Промо', description: 'Призыв вступить в Telegram или Discord.', capabilities: ['ссылка'], preview: 'banner' },

  // ── Инфо ──
  { type: 'search', title: 'Поиск + разделы', group: 'Инфо', description: 'Строка поиска и быстрые чипы разделов.', capabilities: ['авто-чипсы'], preview: 'search' },
  { type: 'socials', title: 'Соцсети', group: 'Инфо', description: 'Ссылки на соцсети проекта.', capabilities: ['ручной список'], preview: 'chips' },
  { type: 'whyUs', title: '«Почему мы»', group: 'Инфо', description: 'Преимущества проекта иконками.', capabilities: ['статично'], preview: 'features' },
  { type: 'faq', title: 'FAQ', group: 'Инфо', description: 'Частые вопросы и ответы аккордеоном.', capabilities: ['ручной список'], preview: 'faq' },
  { type: 'reviews', title: 'Отзывы / цитаты', group: 'Инфо', description: 'Соц-доказательство карточками-цитатами.', capabilities: ['источник: отзывы/ручное'], preview: 'quotes' },
]

const AVAILABLE = new Set<string>(HOME_SECTION_TYPES as readonly string[])

/** Статус секции: реализована (available) или в планах (soon). */
export function sectionStatus(type: string): SectionStatus {
  return AVAILABLE.has(type) ? 'available' : 'soon'
}

/** Полный каталог с вычисленным статусом. */
export const HOME_SECTION_CATALOG: (SectionCatalogEntry & { status: SectionStatus })[] = RAW.map(
  (e) => ({ ...e, status: sectionStatus(e.type) }),
)
