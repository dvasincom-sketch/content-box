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

// --- Парсинг request-хоста (общее для proxy.ts и серверных роутов) ----------

/** host без порта, в нижнем регистре (для сравнения с tenants.domain). */
export function stripPort(host: string | null): string {
  return (host || '').split(':')[0].toLowerCase()
}

/**
 * Прямой поддомен под `*.contentbox.site` из request-хоста → его метка
 * (напр. `bts`). Возвращает null для платформенных хостов и многоуровневых имён
 * (`a.b.contentbox.site`) — такие уходят в резолвинг по собственному домену.
 */
export function subdomainFromHost(host: string): string | null {
  const suffix = `.${PLATFORM_ROOT}`
  if (!host.endsWith(suffix)) return null
  const sub = host.slice(0, -suffix.length)
  if (!sub || sub === 'www' || sub.includes('.')) return null
  return sub
}
