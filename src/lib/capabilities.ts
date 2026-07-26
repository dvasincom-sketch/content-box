/**
 * Возможности, разблокируемые уровнем/подпиской (Фаза 3 «Сообщество»).
 * Выводятся из level (индекс уровня) и платного статуса — без отдельного хранения.
 * Ф4 (UGC) переиспользует isTrusted (авто-одобрение) и canPostToMainFeed.
 */
export function canModerate(level: number | null | undefined): boolean {
  return (Number(level) || 0) >= 3 // «Знаток»+ — общинная модерация (скрытие)
}
export function isTrusted(level: number | null | undefined): boolean {
  return (Number(level) || 0) >= 4 // «Ветеран»+ — авто-одобрение (для Ф4)
}
export function hasFlair(level: number | null | undefined): boolean {
  return (Number(level) || 0) >= 5 // «Легенда» — особый флейр/приоритет
}
export function canPostToMainFeed(hasPaidTier: boolean): boolean {
  return hasPaidTier // общая лента — привилегия платных (реш.7; применяется в Ф4)
}
