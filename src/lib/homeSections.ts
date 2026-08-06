/**
 * Единый источник правды по секциям главной страницы.
 *
 * Импортируется:
 *  - `src/collections/SiteSettings.ts` — для options селекта `homeSections[].type`;
 *  - `src/app/(frontend)/page.tsx` — дефолтный порядок + маппинг type → компонент;
 *  - UI вкладки «Главная страница» (Заход 3) — рендер конструктора и материализация
 *    дефолта при первом сохранении.
 *
 * Модель расширяемая: чтобы добавить новую секцию (в т.ч. будущие
 * «Последнее просмотренное» / «Рекомендуемые» из Задачи 2), достаточно
 * добавить запись в HOME_SECTION_DEFS — типы, options и дефолтный порядок
 * подтянутся автоматически.
 */

/**
 * Порядок записей здесь = дефолтный порядок секций на главной
 * (обратная совместимость: совпадает с текущим захардкоженным JSX в page.tsx).
 * Единственное место, где порядок и состав секций заданы явно.
 *
 * `as const` фиксирует литеральные type/label, из него выводится всё остальное.
 */
export const HOME_SECTION_DEFS = [
  { type: 'hero', label: 'Hero — «Новинка»' },
  { type: 'heroTeam', label: 'По участникам' },
  { type: 'news', label: 'Новости' },
  { type: 'search', label: 'Поиск' },
  { type: 'latest', label: 'Последние публикации' },
  { type: 'popular', label: 'Сейчас популярно' },
  { type: 'discussed', label: 'Обсуждаемое' },
  { type: 'posterRows', label: 'Киноблоки (постеры)' },
  { type: 'photoShowcase', label: 'Фото на весь экран (галерея)' },
  { type: 'categories', label: 'Категории (плитки)' },
  { type: 'popularCategories', label: 'Популярные разделы' },
  { type: 'whyUs', label: '«Почему мы»' },
  { type: 'authorSpotlight', label: 'Об авторе и подписка' },
  { type: 'socials', label: 'Соцсети' },
  { type: 'broadcast', label: 'Баннер «ON AIR»' },
  { type: 'carousel', label: 'Карусель-подборка', default: false },
  { type: 'posterGrid', label: 'Сетка афиш', default: false },
] as const

/** Union всех допустимых типов секций: 'hero' | 'heroTeam' | ... */
export type HomeSectionType = (typeof HOME_SECTION_DEFS)[number]['type']

/** Определение одного типа секции: машинный type + человекочитаемый label. */
export type HomeSectionDef = (typeof HOME_SECTION_DEFS)[number]

/** Вид источника контента секции. */
export type HomeSourceKind = 'auto' | 'category' | 'tag' | 'manual'
export const HOME_SOURCE_KINDS: readonly HomeSourceKind[] = ['auto', 'category', 'tag', 'manual']

/** Источник контента секции (для source-driven секций). */
export interface HomeSectionSource {
  kind: HomeSourceKind
  categoryId?: number | null
  tagId?: number | null
  manualIds?: number[]
  limit?: number | null
}

/** Пер-секционные настройки (хранятся в поле `config` строки массива). */
export interface HomeSectionSettings {
  heading?: string | null
  variant?: string | null
  sectionTheme?: string | null
  source?: HomeSectionSource
  /** Папка галереи для секции «Фото на весь экран» (photoShowcase). */
  galleryFolderId?: number | null
}

/** Одна запись конфигурации главной (элемент массива homeSections). */
export interface HomeSectionConfig {
  /** Стабильный id строки массива (Payload) — ключ для дублей и редактирования. */
  id?: string | number
  type: HomeSectionType
  enabled: boolean
  config?: HomeSectionSettings
}

/** Все типы секций в дефолтном порядке (для options селекта и валидации). */
export const HOME_SECTION_TYPES: readonly HomeSectionType[] = HOME_SECTION_DEFS.map((d) => d.type)

/** Payload-совместимые options для select-поля `homeSections[].type`. */
export const HOME_SECTION_OPTIONS: { label: string; value: HomeSectionType }[] =
  HOME_SECTION_DEFS.map((d) => ({ label: d.label, value: d.type }))

/**
 * Дефолтная конфигурация: все секции включены, порядок из HOME_SECTION_DEFS.
 * Используется, когда `homeSections` в SiteSettings пуст/не сохранён —
 * и на фронте (page.tsx), и в UI при первом открытии вкладки.
 */
export const DEFAULT_HOME_SECTIONS: HomeSectionConfig[] = HOME_SECTION_DEFS
  // Секции с `default: false` (напр. carousel/posterGrid) НЕ входят в дефолтный
  // набор — их добавляют осознанно через конструктор, у существующих сайтов
  // главная не меняется. `'default' in d` сужает union к записи с флагом.
  .filter((d) => !('default' in d) || d.default !== false)
  .map((d) => ({
    type: d.type,
    enabled: true,
  }))

/** Type guard: строка — валидный тип секции (для фильтрации мусора из БД). */
export function isHomeSectionType(value: unknown): value is HomeSectionType {
  return typeof value === 'string' && (HOME_SECTION_TYPES as readonly string[]).includes(value)
}

/**
 * Нормализует сырой `homeSections` из настроек в валидный конфиг:
 *  - пусто/не массив/нет валидных записей → DEFAULT_HOME_SECTIONS (обратная совместимость);
 *  - отбрасывает записи с неизвестным type (напр. удалённый тип секции);
 *  - сохраняет порядок и ДУБЛИ (несколько секций одного типа допускаются);
 *  - НЕ дописывает недостающие секции автоматически — если владелец
 *    сохранил частичный набор, показываем ровно его выбор.
 *
 * enabled приводится к boolean (undefined → true, чтобы старые записи без
 * флага считались включёнными).
 */
/** Санитизация сырого `config` строки секции в HomeSectionSettings (или undefined). */
export function sanitizeSectionConfig(raw: unknown): HomeSectionSettings | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const out: HomeSectionSettings = {}
  if (typeof r.heading === 'string' && r.heading.trim()) out.heading = r.heading
  if (typeof r.variant === 'string' && r.variant) out.variant = r.variant
  if (typeof r.sectionTheme === 'string' && r.sectionTheme) out.sectionTheme = r.sectionTheme
  const folder = Number(r.galleryFolderId)
  if (Number.isFinite(folder) && folder > 0) out.galleryFolderId = folder
  const src = r.source as Record<string, unknown> | undefined
  if (src && typeof src === 'object') {
    const kind = src.kind
    if (typeof kind === 'string' && (HOME_SOURCE_KINDS as readonly string[]).includes(kind)) {
      const source: HomeSectionSource = { kind: kind as HomeSourceKind }
      const cat = Number(src.categoryId)
      if (Number.isFinite(cat) && cat > 0) source.categoryId = cat
      const tag = Number(src.tagId)
      if (Number.isFinite(tag) && tag > 0) source.tagId = tag
      if (Array.isArray(src.manualIds)) {
        const ids = src.manualIds.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
        if (ids.length) source.manualIds = ids
      }
      const lim = Number(src.limit)
      if (Number.isFinite(lim) && lim > 0) source.limit = lim
      out.source = source
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function normalizeHomeSections(raw: unknown): HomeSectionConfig[] {
  if (!Array.isArray(raw)) return DEFAULT_HOME_SECTIONS

  const result: HomeSectionConfig[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const type = (item as { type?: unknown }).type
    if (!isHomeSectionType(type)) continue
    const enabledRaw = (item as { enabled?: unknown }).enabled
    const idRaw = (item as { id?: unknown }).id
    result.push({
      id: typeof idRaw === 'string' || typeof idRaw === 'number' ? idRaw : undefined,
      type,
      enabled: enabledRaw === undefined ? true : Boolean(enabledRaw),
      config: sanitizeSectionConfig((item as { config?: unknown }).config),
    })
  }

  return result.length > 0 ? result : DEFAULT_HOME_SECTIONS
}
