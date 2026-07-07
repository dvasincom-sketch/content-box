/**
 * Русский бейдж давности по календарным дням: сегодня / вчера / N дней назад.
 * Считаем по полуночи локального дня, а не по 24ч-интервалам.
 */
export function relativeDayLabel(input: string | Date | null | undefined): string | null {
  if (!input) return null
  const d = new Date(input)
  if (isNaN(d.getTime())) return null

  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
  const days = Math.round((startOf(new Date()).getTime() - startOf(d).getTime()) / 86400000)

  if (days <= 0) return 'сегодня'
  if (days === 1) return 'вчера'
  // 2..4 → «N дня назад», иначе «N дней назад»
  const word = days >= 2 && days <= 4 ? 'дня назад' : 'дней назад'
  return `${days} ${word}`
}
