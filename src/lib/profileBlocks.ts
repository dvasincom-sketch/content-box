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
  | { id: string; type: 'text'; title?: string; full?: boolean; body: string }
  | { id: string; type: 'timeline'; title?: string; full?: boolean; items: PBTimeline[] }
  | { id: string; type: 'relations'; title?: string; full?: boolean; items: PBRelation[] }
  | { id: string; type: 'releases'; title?: string; full?: boolean; items: PBRelease[] }
  | { id: string; type: 'films'; title?: string; full?: boolean; items: PBRelease[] }
  | { id: string; type: 'awards'; title?: string; full?: boolean; items: PBAward[] }
  | { id: string; type: 'factsList'; title?: string; full?: boolean; items: string[] }
  | { id: string; type: 'gallery'; title?: string; full?: boolean }
  | { id: string; type: 'videos'; title?: string; full?: boolean }
  | { id: string; type: 'columns'; title?: string; full?: boolean; cols: PBColumn[] }
  | { id: string; type: 'callout'; title?: string; full?: boolean; variant?: 'quote' | 'note'; text: string; author?: string }
  | { id: string; type: 'categoryRow'; title?: string; full?: boolean; categoryId?: number | string }

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
  }
}

/** Профиль → список блоков. Если blocks заданы — берём их; иначе строим из legacy. */
export function toBlocks(p: ProfileData | null | undefined): PBlock[] {
  if (!p) return []
  if (Array.isArray(p.blocks) && p.blocks.length) return p.blocks
  const out: PBlock[] = []
  ;(p.sections ?? []).forEach((s, i) => out.push({ id: `text-${i}`, type: 'text', title: s.title, body: s.body }))
  if (p.timeline?.length) out.push({ id: 'timeline', type: 'timeline', title: 'Хронология', items: p.timeline })
  if (p.relations?.length) out.push({ id: 'relations', type: 'relations', title: 'Отношения', items: p.relations })
  if (p.releases?.length) out.push({ id: 'releases', type: 'releases', title: 'Дискография', items: p.releases })
  if (p.films?.length) out.push({ id: 'films', type: 'films', title: 'Фильмография', items: p.films })
  if (p.awards?.length) out.push({ id: 'awards', type: 'awards', title: 'Награды', items: p.awards })
  if (p.facts?.length) out.push({ id: 'facts', type: 'factsList', title: 'Интересные факты', items: p.facts })
  return out
}
