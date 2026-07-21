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
  { type: 'heroTeam', label: 'Участники' },
  { type: 'news', label: 'Новости' },
  { type: 'latest', label: 'Последние публикации' },
  { type: 'popular', label: 'Сейчас популярно' },
  { type: 'discussed', label: 'Обсуждаемое' },
  { type: 'posterRows', label: 'Киноблоки (постеры)' },
  { type: 'categories', label: 'Категории (плитки)' },
  { type: 'popularCategories', label: 'Популярные разделы' },
  { type: 'whyUs', label: '«Почему мы»' },
  { type: 'socials', label: 'Соцсети' },
  { type: 'broadcast', label: 'Баннер «ON AIR»' },
] as const

/** Union всех допустимых типов секций: 'hero' | 'heroTeam' | ... */
export type HomeSectionType = (typeof HOME_SECTION_DEFS)[number]['type']

/** Определение одного типа секции: машинный type + человекочитаемый label. */
export type HomeSectionDef = (typeof HOME_SECTION_DEFS)[number]

/** Одна запись конфигурации главной (элемент массива homeSections). */
export interface HomeSectionConfig {
  type: HomeSectionType
  enabled: boolean
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
export const DEFAULT_HOME_SECTIONS: HomeSectionConfig[] = HOME_SECTION_DEFS.map((d) => ({
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
 *  - дедуплицирует по type (первое вхождение выигрывает);
 *  - НЕ дописывает недостающие секции автоматически — если владелец
 *    сохранил частичный набор, показываем ровно его выбор.
 *
 * enabled приводится к boolean (undefined → true, чтобы старые записи без
 * флага считались включёнными).
 */
export function normalizeHomeSections(raw: unknown): HomeSectionConfig[] {
  if (!Array.isArray(raw)) return DEFAULT_HOME_SECTIONS

  const seen = new Set<HomeSectionType>()
  const result: HomeSectionConfig[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const type = (item as { type?: unknown }).type
    if (!isHomeSectionType(type) || seen.has(type)) continue
    seen.add(type)
    const enabledRaw = (item as { enabled?: unknown }).enabled
    result.push({ type, enabled: enabledRaw === undefined ? true : Boolean(enabledRaw) })
  }

  return result.length > 0 ? result : DEFAULT_HOME_SECTIONS
}
