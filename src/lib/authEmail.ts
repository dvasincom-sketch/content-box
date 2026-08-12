/**
 * Синтетический e-mail телефонных авторов: когда почта не указана, Payload всё
 * равно требует непустой уникальный email (это поле логина в auth). Мы кладём
 * `${phone}@phone.contentbox.local`, но в интерфейсе такой адрес показываем как
 * «не указан» — реального e-mail у автора ещё нет.
 */
const SYNTH_RE = /@phone\.contentbox\.local$/i

export function isSyntheticEmail(email: string | null | undefined): boolean {
  return !!email && SYNTH_RE.test(email)
}

/** Email для показа: null, если синтетический (значит реального нет). */
export function displayEmail(email: string | null | undefined): string | null {
  if (!email || isSyntheticEmail(email)) return null
  return email
}
