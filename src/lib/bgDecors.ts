/**
 * Библиотека фоновых объектов оформления фан-сайта. Автор выбирает ОДИН вариант
 * (или «Нет») в Студии → Оформление; фон рисуется слоем `.bg-decor` (см. styles.css
 * и layout.tsx). Отрисовка — через CSS-маску SVG + `background-color: var(--brand-primary)`,
 * поэтому объекты автоматически подхватывают цвет темы и приглушены, чтобы не мешать
 * чтению. Только курируемый набор — произвольные картинки не разрешаем.
 *
 * kind:
 *  - 'corner' — по объекту в нижних углах (зеркально), для крупных силуэтов (пальмы);
 *  - 'bottom' — сплошная полоса по низу (горы/город/лес/волны);
 *  - 'tile'   — мелкий повторяющийся паттерн по всему фону (звёзды/сердца/…).
 * SVG-файлы: public/theme/decor/<slug>.svg (чёрные силуэты на прозрачном — важна альфа для маски).
 */
export type BgDecorKind = 'corner' | 'bottom' | 'tile'

export interface BgDecorDef {
  slug: string
  name: string
  kind: BgDecorKind
}

export const BG_DECORS: BgDecorDef[] = [
  { slug: 'palms', name: 'Пальмы', kind: 'corner' },
  { slug: 'mountains', name: 'Горы', kind: 'bottom' },
  { slug: 'city', name: 'Город', kind: 'bottom' },
  { slug: 'forest', name: 'Лес', kind: 'bottom' },
  { slug: 'waves', name: 'Волны', kind: 'tile' },
  { slug: 'stars', name: 'Звёзды', kind: 'tile' },
  { slug: 'hearts', name: 'Сердца', kind: 'tile' },
  { slug: 'snowflakes', name: 'Снежинки', kind: 'tile' },
  { slug: 'notes', name: 'Ноты', kind: 'tile' },
  { slug: 'confetti', name: 'Конфетти', kind: 'tile' },
  { slug: 'sakura', name: 'Сакура', kind: 'tile' },
  { slug: 'bubbles', name: 'Пузырьки', kind: 'tile' },
]

/** Слаги для валидации (+ 'none'). */
export const BG_DECOR_SLUGS = BG_DECORS.map((d) => d.slug)

/** Payload-опции для select-поля site-settings.bgDecor. */
export const BG_DECOR_OPTIONS = [
  { label: 'Нет', value: 'none' },
  ...BG_DECORS.map((d) => ({ label: d.name, value: d.slug })),
]

export function getBgDecor(slug?: string | null): BgDecorDef | null {
  if (!slug || slug === 'none') return null
  return BG_DECORS.find((d) => d.slug === slug) ?? null
}
