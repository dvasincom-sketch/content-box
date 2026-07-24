import { verifyEmail } from './templates'
import type { EmailBrand } from './layout'
import type { RenderedEmail } from './templates'

/**
 * Мягкое подтверждение email подписчика.
 *
 * Токен кладём подписчику при регистрации и шлём письмо со ссылкой
 * `/verify-email?token=…` на его сайте. Подтверждение НЕ требуется для входа —
 * это лишь отметка о владении адресом.
 */

// Срок жизни ссылки подтверждения — 3 суток (подписчик может открыть письмо
// не сразу). После истечения нужен повторный запрос.
export const EMAIL_VERIFY_TTL_MS = 3 * 24 * 60 * 60 * 1000

/** Случайный непредсказуемый токен (два UUID = 256 бит). */
export function newEmailVerifyToken(): string {
  const uuid = () => globalThis.crypto.randomUUID().replace(/-/g, '')
  return uuid() + uuid()
}

/** Собрать письмо подтверждения в бренде тенанта, ссылка ведёт на его сайт. */
export function subscriberVerifyMail(args: {
  brand: EmailBrand
  tenantDomain: string
  token: string
  displayName?: string | null
}): RenderedEmail {
  const verifyUrl = `https://${args.tenantDomain}/verify-email?token=${encodeURIComponent(args.token)}`
  return verifyEmail({ brand: args.brand, verifyUrl, name: args.displayName ?? null })
}
