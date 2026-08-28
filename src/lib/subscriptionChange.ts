/**
 * Расчёт смены уровня подписки (апгрейд/даунгрейд) с перерасчётом. Чистые
 * функции без побочек — используются и в API оплаты, и на витрине /subscribe
 * для превью суммы. Период считаем номинально помесячным (30 дней).
 *
 * Правила (согласованы с заказчиком):
 *  • Апгрейд: доплата за остаток по разнице тарифов, дата окончания не меняется,
 *    уровень выше — сразу после оплаты.
 *  • Даунгрейд «сейчас»: без списания; оплаченный остаток текущего периода
 *    конвертируем в доп. дни по новой (низкой) цене → продлеваем дату окончания.
 *  • Даунгрейд «со следующего периода»: ничего не списываем, запоминаем pendingTier,
 *    он применится при автопродлении.
 */

export const PERIOD_DAYS = 30
const DAY_MS = 86_400_000

export type TierLite = { id: number | string; priceRub: number; name?: string }
export type SubState = {
  activeTierId: number | string | null
  activePriceRub: number
  until: Date | null
}

export type SubChangePlan =
  | { kind: 'initial'; amountRub: number }
  | { kind: 'same' }
  | { kind: 'upgrade'; amountRub: number; daysLeft: number }
  | { kind: 'downgrade'; nextAmountRub: number; nowExtraDays: number; daysLeft: number }

/** Целых дней до даты (вверх), 0 если в прошлом/не задано; кэп 366. */
export function daysLeftUntil(until: Date | null, now: Date = new Date()): number {
  if (!until) return 0
  const d = Math.ceil((until.getTime() - now.getTime()) / DAY_MS)
  return d > 0 ? Math.min(d, 366) : 0
}

/** Есть ли активная платная подписка (уровень задан и срок не истёк). */
export function isActiveSub(sub: SubState, now: Date = new Date()): boolean {
  return sub.activeTierId != null && sub.until != null && sub.until.getTime() > now.getTime()
}

/**
 * План перехода на newTier из текущего состояния sub.
 * amountRub округляется до целых рублей.
 */
export function planChange(newTier: TierLite, sub: SubState, now: Date = new Date()): SubChangePlan {
  const newPrice = Math.max(0, Math.round(Number(newTier.priceRub) || 0))

  if (!isActiveSub(sub, now)) return { kind: 'initial', amountRub: newPrice }
  if (String(sub.activeTierId) === String(newTier.id)) return { kind: 'same' }

  const cur = Math.max(0, Math.round(Number(sub.activePriceRub) || 0))
  const dLeft = daysLeftUntil(sub.until, now)

  if (newPrice > cur) {
    // Доплата за остаток ТЕКУЩЕГО месяца по разнице тарифов. Тариф помесячный,
    // поэтому пересчёт ограничиваем одним периодом (30 дней): даже если подписка
    // оплачена далеко вперёд (subscriptionUntil на месяцы/год), повышение стоит
    // не больше разницы в цене за месяц — иначе выходит абсурдная доплата
    // (напр. (2000−490)×366/30 ≈ 18 422 ₽).
    const dCharge = Math.min(dLeft, PERIOD_DAYS)
    const diff = Math.max(1, Math.round(((newPrice - cur) * dCharge) / PERIOD_DAYS))
    return { kind: 'upgrade', amountRub: diff, daysLeft: dLeft }
  }

  // Даунгрейд (в т.ч. равная цена другого уровня): без списания.
  // Остаток стоимости = cur * dLeft/30; в днях по новой цене = остаток / (newPrice/30).
  const nowExtraDays = newPrice > 0 ? Math.max(dLeft, Math.floor((cur * dLeft) / newPrice)) : dLeft
  return { kind: 'downgrade', nextAmountRub: newPrice, nowExtraDays, daysLeft: dLeft }
}
