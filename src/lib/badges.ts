/**
 * Реестр значков (Фаза 3 «Сообщество»). Значки ВЫЧИСЛЯЕМЫЕ — из статистики
 * участника (без отдельного хранения/миграции). Показываются в профиле и кабинете.
 * `exclusive` — значок платного подписчика (флейр, драйвер конверсии, реш.7).
 *
 * У каждого значка есть `icon` (ключ lucide-иконки, маппинг — на стороне рендера)
 * и `color` (базовый hex: фон значка = цвет с прозрачностью, иконка = цвет целиком).
 * `desc` — что значит (для полученных); `howto` — призыв к действию (для ещё не
 * полученных, показывается в подсказке).
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

export type Badge = { id: string; name: string; desc: string; howto: string; icon: string; color: string; exclusive?: boolean }
export type BadgeState = Badge & { earned: boolean }

type BadgeDef = Badge & { has: (s: BadgeStats) => boolean }

const DEFS: BadgeDef[] = [
  { id: 'first-comment', name: 'Первый шаг', desc: 'Первый комментарий', howto: 'Оставьте первый комментарий, чтобы забрать значок', icon: 'message-circle', color: '#22c55e', has: (s) => s.commentCount >= 1 },
  { id: 'talkative', name: 'Разговорчивый', desc: '10+ комментариев', howto: 'Наберите 10 комментариев, чтобы забрать значок', icon: 'messages', color: '#3b82f6', has: (s) => s.commentCount >= 10 },
  { id: 'author', name: 'Автор', desc: 'Первая публикация', howto: 'Опубликуйте первую публикацию, чтобы забрать значок', icon: 'pen', color: '#6366f1', has: (s) => (s.publicationCount ?? 0) >= 1 },
  { id: 'appreciated', name: 'По душе', desc: '25+ полученных реакций', howto: 'Соберите 25 реакций на свои комментарии, чтобы забрать значок', icon: 'heart', color: '#ec4899', has: (s) => s.reactionsReceived >= 25 },
  { id: 'followed', name: 'Замечают', desc: '10+ подписчиков', howto: 'Соберите 10 подписчиков, чтобы забрать значок', icon: 'users', color: '#0ea5e9', has: (s) => (s.followerCount ?? 0) >= 10 },
  { id: 'keeper', name: 'Хранитель', desc: 'Помогает модерировать сообщество', howto: 'Дорастите до уровня «Знаток», чтобы забрать значок', icon: 'shield', color: '#14b8a6', has: (s) => s.level >= 3 },
  { id: 'veteran', name: 'Ветеран', desc: 'Достиг уровня «Ветеран»', howto: 'Дорастите до уровня «Ветеран», чтобы забрать значок', icon: 'medal', color: '#f59e0b', has: (s) => s.level >= 4 },
  { id: 'legend', name: 'Легенда', desc: 'Достиг уровня «Легенда»', howto: 'Дорастите до уровня «Легенда», чтобы забрать значок', icon: 'crown', color: '#8b5cf6', has: (s) => s.level >= 5 },
  { id: 'first-bug', name: 'Первый баг', desc: 'Нашёл подтверждённую ошибку', howto: 'Найдите подтверждённую ошибку, чтобы забрать значок', icon: 'bug', color: '#84cc16', has: (s) => (s.confirmedBugs ?? 0) >= 1 },
  { id: 'bug-hunter', name: 'Багхантер', desc: '5+ подтверждённых багов', howto: 'Найдите 5 подтверждённых багов, чтобы забрать значок', icon: 'target', color: '#f97316', has: (s) => (s.confirmedBugs ?? 0) >= 5 },
  { id: 'supporter', name: 'Подписчик', desc: 'Активная подписка', howto: 'Оформите подписку, чтобы забрать значок', icon: 'star', color: '#eab308', exclusive: true, has: (s) => s.hasPaidTier },
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
