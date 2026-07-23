/**
 * Поддомены авторов под `*.contentbox.site`.
 *
 * Формат: 3–30 символов [a-z0-9-], без крайних и сдвоенных дефисов.
 * Полный домен тенанта = `<subdomain>.contentbox.site` (пишется в tenants.domain).
 *
 * Общий модуль для роута регистрации (/api/register-author) и шага «Адрес»
 * мастера онбординга (/studio/api/onboarding), чтобы правила совпадали.
 */

export const PLATFORM_ROOT = 'contentbox.site'

// Занятые/служебные имена: платформенные хосты и типовые тех-поддомены.
export const RESERVED_SUBDOMAINS = new Set<string>([
  'www', 'admin', 'studio', 'api', 'app', 'mail', 'smtp', 'ftp', 'cdn',
  'static', 'assets', 'media', 'img', 'images', 'blog', 'help', 'support',
  'status', 'dev', 'staging', 'test', 'root', 'contentbox', 'dashboard',
])

const RE = /^(?!-)(?!.*--)[a-z0-9-]{3,30}(?<!-)$/

/** Проверка формата (без учёта занятости). */
export function isValidSubdomain(sub: string): boolean {
  return RE.test(sub)
}

/** Формат ИЛИ зарезервировано → сообщение об ошибке (RU); иначе null. */
export function subdomainError(sub: string): string | null {
  if (!isValidSubdomain(sub)) {
    return 'Поддомен: 3–30 символов, только латиница, цифры и дефис (не по краям).'
  }
  if (RESERVED_SUBDOMAINS.has(sub)) {
    return 'Этот поддомен зарезервирован. Выберите другой.'
  }
  return null
}

/** Полный домен тенанта из поддомена. */
export function domainFromSubdomain(sub: string): string {
  return `${sub}.${PLATFORM_ROOT}`
}

/** Нормализация пользовательского ввода поддомена. */
export function normalizeSubdomain(input: string): string {
  return (input || '').trim().toLowerCase()
}
