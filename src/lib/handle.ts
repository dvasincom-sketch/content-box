/**
 * Правила адреса профиля участника (`/u/<handle>`).
 * Переиспользуют формат и резерв поддоменов (lib/subdomain.ts), плюс
 * несколько служебных слов фронта. Уникальность — в рамках тенанта (проверка
 * в API + партиал-уникальный индекс БД).
 */
import { isValidSubdomain, RESERVED_SUBDOMAINS, normalizeSubdomain } from './subdomain'
import { slugify } from './slugify'

const EXTRA_RESERVED = new Set<string>([
  'u', 'me', 'settings', 'profile', 'account', 'login', 'logout', 'register',
])

export function normalizeHandle(input: string): string {
  return normalizeSubdomain(input)
}

export function isValidHandle(h: string): boolean {
  return isValidSubdomain(h)
}

/** Ошибка формата/резерва (RU) или null, если ок. Занятость проверяется отдельно. */
export function handleError(h: string): string | null {
  if (!isValidHandle(h)) {
    return 'Адрес: 3–30 символов, латиница, цифры и дефис (не по краям).'
  }
  if (RESERVED_SUBDOMAINS.has(h) || EXTRA_RESERVED.has(h)) {
    return 'Этот адрес зарезервирован. Выберите другой.'
  }
  return null
}

/** Предложить валидный handle из имени/почты (для первого входа). */
export function suggestHandle(seed: string): string {
  let h = slugify(seed || '').replace(/[^a-z0-9-]/g, '').slice(0, 30)
  if (h.length < 3) h = `user-${h}`.slice(0, 30)
  return h.replace(/^-+|-+$/g, '')
}
