import { passwordResetEmail } from './templates'
import { emailBrandForTenant } from './tenantBrand'
import { PLATFORM_BRAND, type EmailBrand } from './layout'

/**
 * Генераторы письма сброса пароля для auth-коллекций Payload
 * (forgotPassword.generateEmailSubject / generateEmailHTML).
 *
 * Автор (users) — бренд платформы, ссылка на страницу сброса студии.
 * Подписчик (subscribers) — бренд тенанта, ссылка на страницу сброса его сайта.
 */

// Аргументы, которые Payload передаёт в generateEmailHTML/Subject.
type ForgotArgs = { req?: any; token?: string; user?: any } | undefined

const platformHost = (PLATFORM_BRAND.siteUrl || 'https://contentbox.site').replace(/^https?:\/\//, '')

// ── Автор (users) ──────────────────────────────────────────────────────────

export function authorResetSubject(): string {
  return passwordResetEmail({ brand: PLATFORM_BRAND, resetUrl: '' }).subject
}

export function authorResetHTML(args: ForgotArgs): string {
  const token = (args?.token as string) || ''
  const resetUrl = `${PLATFORM_BRAND.siteUrl}/studio/reset-password?token=${encodeURIComponent(token)}`
  return passwordResetEmail({ brand: PLATFORM_BRAND, resetUrl, name: args?.user?.name ?? null }).html
}

// ── Подписчик (subscribers) ────────────────────────────────────────────────

async function resolveSubscriberBrand(
  args: ForgotArgs,
): Promise<{ brand: EmailBrand; tenantDomain: string }> {
  const payload = args?.req?.payload
  const user = args?.user
  const rawTenant = user?.tenant
  const tenantId = rawTenant && typeof rawTenant === 'object' ? rawTenant.id : rawTenant

  let tenant: { name?: string | null; domain?: string | null } | null = null
  let settings: any = null
  if (payload && tenantId != null) {
    tenant = await payload
      .findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
      .catch(() => null)
    const s = await payload
      .find({
        collection: 'site-settings',
        where: { tenant: { equals: tenantId } },
        depth: 1,
        limit: 1,
        overrideAccess: true,
      })
      .catch(() => null)
    settings = s?.docs?.[0] ?? null
  }
  return {
    brand: emailBrandForTenant(tenant, settings),
    tenantDomain: tenant?.domain || platformHost,
  }
}

export async function subscriberResetSubject(args: ForgotArgs): Promise<string> {
  const { brand } = await resolveSubscriberBrand(args)
  return passwordResetEmail({ brand, resetUrl: '' }).subject
}

export async function subscriberResetHTML(args: ForgotArgs): Promise<string> {
  const token = (args?.token as string) || ''
  const { brand, tenantDomain } = await resolveSubscriberBrand(args)
  const resetUrl = `https://${tenantDomain}/reset-password?token=${encodeURIComponent(token)}`
  return passwordResetEmail({ brand, resetUrl, name: args?.user?.displayName ?? null }).html
}
