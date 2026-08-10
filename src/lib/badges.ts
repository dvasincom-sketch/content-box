/**
 * Реестр значков (Фаза 3 «Сообщество»). Значки ВЫЧИСЛЯЕМЫЕ — из статистики
 * участника (без отдельного хранения/миграции). Показываются в профиле и кабинете.
 * `exclusive` — значок платного подписчика (флейр, драйвер конверсии, реш.7).
 *
 * У каждого значка есть `icon` (ключ lucide-иконки, маппинг — на стороне рендера)
 * и `color` (базовый hex: фон значка = цвет с прозрачностью, иконка = цвет целиком).
 * `desc` заодно служит подсказкой «как получить» для ещё не заработанных значков.
 */
export type BadgeStats = {
  commentCount: number
  reactionsReceived: number
  level: number
  hasPaidTier: boolean
  /** Подтверждённых баг-репортов (баг-баунти). Необязательно — по умолчанию 0. */
  confirmedBugs?: number
  /** Подписчиков (для значка «Замечают»). */
  followerCount?: number
  /** Своих публикаций (для значка «Автор»). */
  publicationCount?: number
}

export type Badge = { id: string; name: string; desc: string; icon: string; color: string; exclusive?: boolean }
export type BadgeState = Badge & { earned: boolean }

type BadgeDef = Badge & { has: (s: BadgeStats) => boolean }

const DEFS: BadgeDef[] = [
  { id: 'first-comment', name: 'Первый шаг', desc: 'Первый комментарий', icon: 'message-circle', color: '#22c55e', has: (s) => s.commentCount >= 1 },
  { id: 'talkative', name: 'Разговорчивый', desc: '10+ комментариев', icon: 'messages', color: '#3b82f6', has: (s) => s.commentCount >= 10 },
  { id: 'author', name: 'Автор', desc: 'Первая публикация', icon: 'pen', color: '#6366f1', has: (s) => (s.publicationCount ?? 0) >= 1 },
  { id: 'appreciated', name: 'По душе', desc: '25+ полученных реакций', icon: 'heart', color: '#ec4899', has: (s) => s.reactionsReceived >= 25 },
  { id: 'followed', name: 'Замечают', desc: '10+ подписчиков', icon: 'users', color: '#0ea5e9', has: (s) => (s.followerCount ?? 0) >= 10 },
  { id: 'keeper', name: 'Хранитель', desc: 'Помогает модерировать сообщество', icon: 'shield', color: '#14b8a6', has: (s) => s.level >= 3 },
  { id: 'veteran', name: 'Ветеран', desc: 'Достиг уровня «Ветеран»', icon: 'medal', color: '#f59e0b', has: (s) => s.level >= 4 },
  { id: 'legend', name: 'Легенда', desc: 'Достиг уровня «Легенда»', icon: 'crown', color: '#8b5cf6', has: (s) => s.level >= 5 },
  { id: 'first-bug', name: 'Первый баг', desc: 'Нашёл подтверждённую ошибку', icon: 'bug', color: '#84cc16', has: (s) => (s.confirmedBugs ?? 0) >= 1 },
  { id: 'bug-hunter', name: 'Багхантер', desc: '5+ подтверждённых багов', icon: 'target', color: '#f97316', has: (s) => (s.confirmedBugs ?? 0) >= 5 },
  { id: 'supporter', name: 'Подписчик', desc: 'Активная подписка', icon: 'star', color: '#eab308', exclusive: true, has: (s) => s.hasPaidTier },
]

function strip({ has: _has, ...b }: BadgeDef): Badge {
  return b
}

/** Только заработанные значки (для компактного показа, напр. на публичном профиле). */
export function earnedBadges(s: BadgeStats): Badge[] {
  return DEFS.filter((d) => d.has(s)).map(strip)
}

/** Все значки со статусом earned: заработанные впереди, дальше — залоченные. */
export function allBadges(s: BadgeStats): BadgeState[] {
  const list = DEFS.map((d) => ({ ...strip(d), earned: d.has(s) }))
  return [...list.filter((b) => b.earned), ...list.filter((b) => !b.earned)]
}
