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

export type PBlock =
  | { id: string; type: 'text'; title?: string; body: string }
  | { id: string; type: 'timeline'; title?: string; items: PBTimeline[] }
  | { id: string; type: 'relations'; title?: string; items: PBRelation[] }
  | { id: string; type: 'releases'; title?: string; items: PBRelease[] }
  | { id: string; type: 'films'; title?: string; items: PBRelease[] }
  | { id: string; type: 'awards'; title?: string; items: PBAward[] }
  | { id: string; type: 'factsList'; title?: string; items: string[] }
  | { id: string; type: 'gallery'; title?: string }
  | { id: string; type: 'videos'; title?: string }

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
export const BLOCK_LABEL: Record<PBlockType, string> = {
  text: 'Раздел',
  timeline: 'Хронология',
  relations: 'Отношения',
  releases: 'Дискография',
  films: 'Фильмография',
  awards: 'Награды',
  factsList: 'Интересные факты',
  gallery: 'Галерея',
  videos: 'Видео',
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
  }
}

/** Профиль → список блоков. Если blocks заданы — берём их; иначе строим из legacy. */
export function toBlocks(p: ProfileData | null | undefined): PBlock[] {
  if (!p) return []
  if (Array.isArray(p.blocks) && p.blocks.length) return p.blocks
  const out: PBlock[] = []
  ;(p.sections ?? []).forEach((s, i) => out.push({ id: `text-${i}`, type: 'text', title: s.title, body: s.body }))
  if (p.timeline?.length) out.push({ id: 'timeline', type: 'timeline', items: p.timeline })
  if (p.relations?.length) out.push({ id: 'relations', type: 'relations', items: p.relations })
  if (p.releases?.length) out.push({ id: 'releases', type: 'releases', items: p.releases })
  if (p.films?.length) out.push({ id: 'films', type: 'films', items: p.films })
  if (p.awards?.length) out.push({ id: 'awards', type: 'awards', items: p.awards })
  if (p.facts?.length) out.push({ id: 'facts', type: 'factsList', items: p.facts })
  return out
}
