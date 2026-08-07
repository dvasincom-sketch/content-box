/**
 * Конфиг веб-аналитики (self-hosted Umami). Секреты — только из env, не из
 * site-settings: URL скрипта/API, токен/логин задаёт платформа, а не автор.
 *
 * `UMAMI_SCRIPT_URL` — публичный src трекера, напр. https://analytics.contentbox.site/script.js
 * `UMAMI_API_URL`    — база API для чтения агрегатов, напр. https://analytics.contentbox.site/api
 * Авторизация к API — одним из двух способов:
 *   `UMAMI_API_TOKEN`                    — готовый bearer-токen / API-ключ, ЛИБО
 *   `UMAMI_API_USER` + `UMAMI_API_PASSWORD` — логин/пароль (self-hosted): код сам
 *                                          дёргает POST /auth/login и кэширует токен.
 * Ничего из этого на фронт не попадает (только серверный код).
 *
 * Пока значения не заданы — всё это no-op: трекер не подключается (см.
 * <UmamiTracker>), раздел «Аналитика» показывает состояние «не настроено».
 */
export const UMAMI_SCRIPT_URL = (process.env.UMAMI_SCRIPT_URL || '').trim()
export const UMAMI_API_URL = (process.env.UMAMI_API_URL || '').replace(/\/+$/, '')
export const UMAMI_API_TOKEN = (process.env.UMAMI_API_TOKEN || '').trim()
export const UMAMI_API_USER = (process.env.UMAMI_API_USER || '').trim()
export const UMAMI_API_PASSWORD = (process.env.UMAMI_API_PASSWORD || '').trim()

/** Трекер можно вставлять: задан публичный src скрипта. */
export function umamiTrackingEnabled(): boolean {
  return UMAMI_SCRIPT_URL.length > 0
}

/** Чтение агрегатов доступно: задан API-URL и способ авторизации. */
export function umamiApiEnabled(): boolean {
  if (!UMAMI_API_URL) return false
  return UMAMI_API_TOKEN.length > 0 || (UMAMI_API_USER.length > 0 && UMAMI_API_PASSWORD.length > 0)
}
