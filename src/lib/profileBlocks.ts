/**
 * Модель блоков публикации-«Профиль». Профиль состоит из фиксированной шапки
 * (eyebrow/subtitle/lead/quickFacts) и упорядоченного списка БЛОКОВ, которые
 * автор добавляет/удаляет/двигает (конструктор). Старые профили с «плоскими»
 * полями (sections/timeline/…) читаются через toBlocks() — совместимость.
 */
export type PBFact = { label: string; value: string }
export type PBTimeline = { year: string; title: string; text?: string }
export type PBRelation = { name: string; text: string }
export type PBRelease = { title: string; meta?: string; year?: string }
export type PBAward = { title: string; subtitle?: string; icon?: string }
export type PBColumn = { title?: string; body: string }

export type PBlock =
  | { id: string; type: 'text'; title?: string; full?: boolean; enabled?: boolean; body: string }
  | { id: string; type: 'timeline'; title?: string; full?: boolean; enabled?: boolean; items: PBTimeline[] }
  | { id: string; type: 'relations'; title?: string; full?: boolean; enabled?: boolean; items: PBRelation[] }
  | { id: string; type: 'releases'; title?: string; full?: boolean; enabled?: boolean; items: PBRelease[] }
  | { id: string; type: 'films'; title?: string; full?: boolean; enabled?: boolean; items: PBRelease[] }
  | { id: string; type: 'awards'; title?: string; full?: boolean; enabled?: boolean; items: PBAward[] }
  | { id: string; type: 'factsList'; title?: string; full?: boolean; enabled?: boolean; items: string[] }
  | { id: string; type: 'gallery'; title?: string; full?: boolean; enabled?: boolean }
  | { id: string; type: 'videos'; title?: string; full?: boolean; enabled?: boolean }
  | { id: string; type: 'columns'; title?: string; full?: boolean; enabled?: boolean; cols: PBColumn[] }
  | { id: string; type: 'callout'; title?: string; full?: boolean; enabled?: boolean; variant?: 'quote' | 'note'; text: string; author?: string }
  | { id: string; type: 'categoryRow'; title?: string; full?: boolean; enabled?: boolean; categoryId?: number | string }
  | { id: string; type: 'button'; title?: string; full?: boolean; enabled?: boolean; label: string; href: string; variant?: 'primary' | 'ghost' }
  | { id: string; type: 'divider'; title?: string; full?: boolean; enabled?: boolean; variant?: 'line' | 'dots' | 'space' }
  | { id: string; type: 'publications'; title?: string; full?: boolean; enabled?: boolean; ids: (number | string)[] }
  | { id: string; type: 'hero'; title?: string; full?: boolean; enabled?: boolean; eyebrow?: string; subtitle?: string; lead?: string; imageUrl?: string }
  | { id: string; type: 'facts'; title?: string; full?: boolean; enabled?: boolean; items: PBFact[] }

export type PBlockType = PBlock['type']

export type ProfileData = {
  eyebrow?: string
  subtitle?: string
  lead?: string
  quickFacts?: PBFact[]
  blocks?: PBlock[]
  // ── legacy (плоские поля старых профилей) ──
  sections?: { title: string; body: string }[]
  timeline?: PBTimeline[]
  relations?: PBRelation[]
  releases?: PBRelease[]
  films?: PBRelease[]
  awards?: PBAward[]
  facts?: string[]
}

/** Заголовок блока по умолчанию (если у блока не задан свой title). */
// Названия по стилю отображения, а не по смыслу — конструктор универсален
// (подходит под любую тему, не только профили участников). Заголовок секции
// на странице всё равно задаётся через title блока.
export const BLOCK_LABEL: Record<PBlockType, string> = {
  hero: 'Шапка',
  facts: 'Быстрые факты',
  text: 'Текст',
  timeline: 'Хронология',
  relations: 'Аккордеон',
  releases: 'Постеры',
  films: 'Карточки',
  awards: 'Плашки',
  factsList: 'Плитки',
  gallery: 'Галерея',
  videos: 'Видео',
  columns: 'Колонки',
  callout: 'Выноска',
  categoryRow: 'Ряд-постеры',
  button: 'Кнопка',
  divider: 'Разделитель',
  publications: 'Публикации',
}

/** Пустой блок нужного типа (для «Добавить»). id генерирует вызывающий. */
export function blankBlock(type: PBlockType, id: string): PBlock {
  switch (type) {
    case 'text': return { id, type, title: '', body: '' }
    case 'timeline': return { id, type, items: [] }
    case 'relations': return { id, type, items: [] }
    case 'releases': return { id, type, items: [] }
    case 'films': return { id, type, items: [] }
    case 'awards': return { id, type, items: [] }
    case 'factsList': return { id, type, items: [] }
    case 'gallery': return { id, type }
    case 'videos': return { id, type }
    case 'columns': return { id, type, cols: [{ body: '' }, { body: '' }] }
    case 'callout': return { id, type, variant: 'quote', text: '' }
    case 'categoryRow': return { id, type }
    case 'button': return { id, type, label: '', href: '', variant: 'primary' }
    case 'divider': return { id, type, variant: 'line' }
    case 'publications': return { id, type, ids: [] }
    case 'hero': return { id, type, eyebrow: '', subtitle: '', lead: '', imageUrl: '' }
    case 'facts': return { id, type, items: [{ label: '', value: '' }] }
  }
}

/** Профиль → список блоков. Если blocks заданы — берём их; иначе строим из legacy. */
export function toBlocks(p: ProfileData | null | undefined): PBlock[] {
  if (!p) return []
  // База: либо уже сохранённые блоки, либо построение из legacy-полей.
  let base: PBlock[]
  if (Array.isArray(p.blocks) && p.blocks.length) {
    base = p.blocks
  } else {
    base = []
    ;(p.sections ?? []).forEach((s, i) => base.push({ id: `text-${i}`, type: 'text', title: s.title, body: s.body }))
    if (p.timeline?.length) base.push({ id: 'timeline', type: 'timeline', title: 'Хронология', items: p.timeline })
    if (p.relations?.length) base.push({ id: 'relations', type: 'relations', title: 'Отношения', items: p.relations })
    if (p.releases?.length) base.push({ id: 'releases', type: 'releases', title: 'Дискография', items: p.releases })
    if (p.films?.length) base.push({ id: 'films', type: 'films', title: 'Фильмография', items: p.films })
    if (p.awards?.length) base.push({ id: 'awards', type: 'awards', title: 'Награды', items: p.awards })
    if (p.facts?.length) base.push({ id: 'factslist', type: 'factsList', title: 'Интересные факты', items: p.facts })
  }
  // Шапка и «Быстрые факты» — тоже блоки. Если их ещё нет среди блоков,
  // синтезируем из legacy-полей hero (совместимость со старыми страницами).
  const pre: PBlock[] = []
  if (!base.some((b) => b.type === 'hero')) {
    pre.push({ id: 'hero', type: 'hero', eyebrow: p.eyebrow, subtitle: p.subtitle, lead: p.lead })
  }
  if (!base.some((b) => b.type === 'facts') && p.quickFacts?.length) {
    pre.push({ id: 'quickfacts', type: 'facts', items: p.quickFacts })
  }
  return [...pre, ...base]
}
