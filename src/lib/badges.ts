/**
 * Реестр значков (Фаза 3 «Сообщество»). Значки ВЫЧИСЛЯЕМЫЕ — из статистики
 * участника (без отдельного хранения/миграции). Показываются в профиле и кабинете.
 * `exclusive` — значок платного подписчика (флейр, драйвер конверсии, реш.7).
 */
export type BadgeStats = {
  commentCount: number
  reactionsReceived: number
  level: number
  hasPaidTier: boolean
}

export type Badge = { id: string; name: string; desc: string; exclusive?: boolean }

type BadgeDef = Badge & { has: (s: BadgeStats) => boolean }

const DEFS: BadgeDef[] = [
  { id: 'first-comment', name: 'Первый шаг', desc: 'Первый комментарий', has: (s) => s.commentCount >= 1 },
  { id: 'talkative', name: 'Разговорчивый', desc: '10+ комментариев', has: (s) => s.commentCount >= 10 },
  { id: 'appreciated', name: 'По душе', desc: '25+ полученных реакций', has: (s) => s.reactionsReceived >= 25 },
  { id: 'keeper', name: 'Хранитель', desc: 'Помогает модерировать сообщество', has: (s) => s.level >= 3 },
  { id: 'veteran', name: 'Ветеран', desc: 'Достиг уровня «Ветеран»', has: (s) => s.level >= 4 },
  { id: 'legend', name: 'Легенда', desc: 'Достиг уровня «Легенда»', has: (s) => s.level >= 5 },
  { id: 'supporter', name: 'Подписчик', desc: 'Активная подписка', exclusive: true, has: (s) => s.hasPaidTier },
]

export function earnedBadges(s: BadgeStats): Badge[] {
  return DEFS.filter((d) => d.has(s)).map(({ has, ...b }) => b)
}
