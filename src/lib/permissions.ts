/**
 * Данные модели прав доступа — единый источник для сервера (src/access) и
 * студийного UI. БЕЗ payload-импортов, чтобы модуль можно было тянуть в клиент.
 */

export type ContentAction = 'create' | 'viewAny' | 'editOwn' | 'editAny' | 'deleteOwn' | 'deleteAny'
export type ContentCaps = Partial<Record<ContentAction, boolean>>
export type ManageCaps = { manage?: boolean }
export type ModerateCaps = { moderate?: boolean }

export const CONTENT_ENTITIES = ['posts', 'videos', 'books', 'gallery', 'downloads'] as const
export type ContentEntity = (typeof CONTENT_ENTITIES)[number]

export type CapMatrix = {
  posts?: ContentCaps; videos?: ContentCaps; books?: ContentCaps; gallery?: ContentCaps; downloads?: ContentCaps
  taxonomy?: ManageCaps; menu?: ManageCaps; pages?: ManageCaps
  appearance?: ManageCaps; home?: ManageCaps; tiers?: ManageCaps; goals?: ManageCaps; authorShowcase?: ManageCaps
  commentsModeration?: ModerateCaps; bugReports?: ManageCaps
  access?: ManageCaps
}

export type EntityKind = 'content' | 'manage' | 'moderate'
export type EntityMeta = { key: keyof CapMatrix; label: string; kind: EntityKind }
export type EntityGroup = { title: string; items: EntityMeta[] }

/** Группы сущностей для матрицы в UI. */
export const ENTITY_GROUPS: EntityGroup[] = [
  { title: 'Контент', items: [
    { key: 'posts', label: 'Публикации', kind: 'content' },
    { key: 'videos', label: 'Видео', kind: 'content' },
    { key: 'books', label: 'Книги', kind: 'content' },
    { key: 'gallery', label: 'Галерея', kind: 'content' },
    { key: 'downloads', label: 'Файлы', kind: 'content' },
  ] },
  { title: 'Структура', items: [
    { key: 'taxonomy', label: 'Категории и разделы', kind: 'manage' },
    { key: 'menu', label: 'Меню и футер', kind: 'manage' },
    { key: 'pages', label: 'Страницы', kind: 'manage' },
  ] },
  { title: 'Витрина', items: [
    { key: 'appearance', label: 'Оформление', kind: 'manage' },
    { key: 'home', label: 'Главная (конструктор)', kind: 'manage' },
    { key: 'tiers', label: 'Подписки и тарифы', kind: 'manage' },
    { key: 'goals', label: 'Цели сбора', kind: 'manage' },
    { key: 'authorShowcase', label: 'Витрина автора', kind: 'manage' },
  ] },
  { title: 'Сообщество', items: [
    { key: 'commentsModeration', label: 'Модерация комментариев', kind: 'moderate' },
    { key: 'bugReports', label: 'Баг-репорты', kind: 'manage' },
  ] },
  { title: 'Команда', items: [
    { key: 'access', label: 'Управление доступом', kind: 'manage' },
  ] },
]

/** Действия для контентных сущностей (столбцы матрицы). */
export const CONTENT_ACTIONS: { key: ContentAction; label: string }[] = [
  { key: 'create', label: 'Создавать' },
  { key: 'viewAny', label: 'Видеть чужое' },
  { key: 'editOwn', label: 'Ред. своё' },
  { key: 'editAny', label: 'Ред. чужое' },
  { key: 'deleteOwn', label: 'Удал. своё' },
  { key: 'deleteAny', label: 'Удал. чужое' },
]

const fullContent = (): ContentCaps => ({ create: true, viewAny: true, editOwn: true, editAny: true, deleteOwn: true, deleteAny: true })
const ownContent = (): ContentCaps => ({ create: true, viewAny: false, editOwn: true, editAny: false, deleteOwn: true, deleteAny: false })
const viewContent = (): ContentCaps => ({ viewAny: true })
const modContent = (): ContentCaps => ({ viewAny: true, editAny: true })

/** Пресеты ролей: заполняют матрицу; дальше донастраиваются вручную. */
export const PRESETS: Record<string, CapMatrix> = {
  admin: {
    posts: fullContent(), videos: fullContent(), books: fullContent(), gallery: fullContent(), downloads: fullContent(),
    taxonomy: { manage: true }, menu: { manage: true }, pages: { manage: true },
    appearance: { manage: true }, home: { manage: true }, tiers: { manage: true }, goals: { manage: true }, authorShowcase: { manage: true },
    commentsModeration: { moderate: true }, bugReports: { manage: true }, access: { manage: true },
  },
  editor: {
    posts: fullContent(), videos: fullContent(), books: fullContent(), gallery: fullContent(), downloads: fullContent(),
    taxonomy: { manage: true }, menu: { manage: true }, pages: { manage: true }, home: { manage: true },
    commentsModeration: { moderate: true }, bugReports: { manage: true },
  },
  author: {
    posts: ownContent(), videos: ownContent(), books: ownContent(), gallery: ownContent(), downloads: ownContent(),
  },
  moderator: {
    posts: modContent(), videos: modContent(), books: modContent(), gallery: modContent(), downloads: modContent(),
    commentsModeration: { moderate: true }, bugReports: { manage: true },
  },
  viewer: {
    posts: viewContent(), videos: viewContent(), books: viewContent(), gallery: viewContent(), downloads: viewContent(),
  },
  owner: {}, // не используется: владелец короткозамкнут isFullStaff
}

/** Пресеты, доступные для назначения участнику (без owner — им управляет владение тенантом). */
export const ASSIGNABLE_PRESETS = ['editor', 'author', 'moderator', 'viewer', 'admin'] as const

export const PRESET_LABELS: Record<string, string> = {
  owner: 'Владелец', admin: 'Администратор', editor: 'Редактор', author: 'Автор',
  moderator: 'Модератор', viewer: 'Наблюдатель', custom: 'Своя настройка',
}

export const PRESET_HINTS: Record<string, string> = {
  admin: 'Полный доступ, включая настройки и команду',
  editor: 'Весь контент и структура; без тарифов, оформления и команды',
  author: 'Создаёт контент и правит только свой',
  moderator: 'Модерация и правка чужого контента; без создания и настроек',
  viewer: 'Только просмотр студии',
  custom: 'Права заданы вручную',
}

/** Совпадает ли матрица с пресетом (для показа названия роли в UI). */
export function matchPreset(caps: CapMatrix): string {
  for (const key of Object.keys(PRESETS)) {
    if (key === 'owner') continue
    if (JSON.stringify(normalize(PRESETS[key])) === JSON.stringify(normalize(caps))) return key
  }
  return 'custom'
}

/** Нормализуем матрицу (только true-значения) для сравнения. */
export function normalize(caps: CapMatrix): Record<string, Record<string, boolean>> {
  const out: Record<string, Record<string, boolean>> = {}
  for (const [ent, node] of Object.entries(caps || {})) {
    if (!node) continue
    const inner: Record<string, boolean> = {}
    for (const [act, val] of Object.entries(node)) if (val) inner[act] = true
    if (Object.keys(inner).length) out[ent] = inner
  }
  return out
}

/** Проверка права по матрице (для UI). Владельца проверяйте отдельно (isOwner). */
export function hasCap(abilities: CapMatrix | null | undefined, entity: keyof CapMatrix, action: string): boolean {
  const node = abilities?.[entity] as Record<string, boolean> | undefined
  return Boolean(node && node[action])
}

/** Ключи «управляемых» разделов настроек (для показа пункта «Настройки»). */
export const SETTINGS_MANAGE_KEYS: (keyof CapMatrix)[] = ['appearance', 'home', 'menu', 'tiers', 'goals', 'authorShowcase', 'taxonomy']
