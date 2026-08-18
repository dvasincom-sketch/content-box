/**
 * Тарификация токенов ассистента Аси. Ставки — платформенные, за 1 млн токенов.
 * Токены пока оценочные (по длине текста), поэтому стоимость — тоже оценка.
 */
export const RATE_IN_RUB_PER_M = 2025 // ₽ за 1 млн входящих токенов
export const RATE_OUT_RUB_PER_M = 10125 // ₽ за 1 млн исходящих токенов

/** Стоимость (₽) для заданного числа входящих/исходящих токенов. */
export function costRub(tokensIn: number, tokensOut: number): number {
  const ti = Math.max(0, tokensIn || 0)
  const to = Math.max(0, tokensOut || 0)
  return (ti / 1_000_000) * RATE_IN_RUB_PER_M + (to / 1_000_000) * RATE_OUT_RUB_PER_M
}
