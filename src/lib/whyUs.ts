/**
 * Секция «Почему мы» на главной. Раньше карточки были захардкожены в page.tsx —
 * теперь редактируются в конструкторе главной (SiteSettings.whyUs, json). Здесь
 * общий тип, набор иконок и дефолт (фолбэк, когда владелец ничего не задал).
 */

export type WhyIcon =
  | 'library'
  | 'zap'
  | 'globe'
  | 'heart'
  | 'mic'
  | 'screen'
  | 'clock'
  | 'calendar'

export type WhyItem = { icon: WhyIcon; title: string; text: string }

export const WHY_ICONS: WhyIcon[] = ['library', 'zap', 'globe', 'heart', 'mic', 'screen', 'clock', 'calendar']

/** Человекочитаемые подписи иконок для селекта в редакторе. */
export const WHY_ICON_LABELS: Record<WhyIcon, string> = {
  library: 'Библиотека',
  zap: 'Молния',
  globe: 'Глобус',
  heart: 'Сердце',
  mic: 'Микрофон',
  screen: 'Экран',
  clock: 'Часы',
  calendar: 'Календарь',
}

/** Дефолтные карточки — показываются, пока владелец не задал свои. */
export const DEFAULT_WHYUS: WhyItem[] = [
  { icon: 'library', title: 'Эксклюзивный контент', text: 'Материалы, которых нет в открытом доступе — только для вашей аудитории.' },
  { icon: 'zap', title: 'Регулярные обновления', text: 'Новые публикации и видео выходят стабильно, а подписчики узнают о них первыми.' },
  { icon: 'globe', title: 'Доступ по подписке', text: 'Гибкие уровни доступа: часть материалов открыта всем, часть — для подписчиков.' },
  { icon: 'heart', title: 'Живое сообщество', text: 'Комментарии, реакции и обсуждения объединяют читателей вокруг вашего проекта.' },
]

const isWhyIcon = (v: unknown): v is WhyIcon => typeof v === 'string' && (WHY_ICONS as string[]).includes(v)

/** Разобрать сырое значение из БД/запроса в чистый список карточек. */
export function normalizeWhyUs(raw: unknown): WhyItem[] {
  if (!Array.isArray(raw)) return []
  const out: WhyItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const title = String((item as any).title ?? '').trim()
    const text = String((item as any).text ?? '').trim()
    if (!title && !text) continue
    const icon = isWhyIcon((item as any).icon) ? (item as any).icon : 'zap'
    out.push({ icon, title: title.slice(0, 120), text: text.slice(0, 400) })
  }
  return out
}

/** Итоговые карточки для рендера: сохранённые или дефолт. */
export function resolveWhyUs(raw: unknown): WhyItem[] {
  const items = normalizeWhyUs(raw)
  return items.length > 0 ? items : DEFAULT_WHYUS
}
