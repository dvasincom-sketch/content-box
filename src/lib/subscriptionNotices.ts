import type { Payload } from 'payload'
import { emailBrandForTenant, subscriptionNoticeEmail, type SubscriptionNoticeKind } from '@/emails'

/**
 * Общая сборка писем об окончании подписки — для планировщика
 * (/api/notifications/subscription-expiry) и тестовой кнопки студии
 * (/studio/api/subscription-notice-test).
 */

/** За сколько дней до окончания шлём напоминание. */
export const REMIND_DAYS = 3

/** Контекст тенанта для писем: бренд, домен, аватар автора. */
export type TenantNoticeCtx = {
  /** Активный тенант с подтверждённым доменом (условия как у дайджеста). */
  ok: boolean
  domain: string
  name: string
  brand: ReturnType<typeof emailBrandForTenant>
  avatarUrl: string | null
}

export async function loadTenantNoticeCtx(payload: Payload, tenantId: number): Promise<TenantNoticeCtx | null> {
  const tenant = (await payload
    .findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
    .catch(() => null)) as any
  if (!tenant?.domain) return null
  const sRes = await payload
    .find({ collection: 'site-settings', where: { tenant: { equals: tenantId } }, limit: 1, depth: 1, overrideAccess: true })
    .catch(() => null)
  const settings = (sRes?.docs?.[0] as any) ?? null
  const domain = String(tenant.domain)
  // Медиа может отдаваться относительным путём — в письме нужен абсолютный URL.
  const abs = (u: unknown): string | null => {
    if (typeof u !== 'string' || !u) return null
    return u.startsWith('/') ? `https://${domain}${u}` : u
  }
  const icon = settings?.appIcon && typeof settings.appIcon === 'object' ? settings.appIcon : null
  const logo = settings?.logo && typeof settings.logo === 'object' ? settings.logo : null
  const brand = emailBrandForTenant(tenant, settings)
  brand.logoUrl = abs(brand.logoUrl)
  return {
    ok: tenant.status === 'active' && tenant.domainVerified === true,
    domain,
    name: String(tenant.name || brand.name || domain),
    brand,
    avatarUrl: abs(icon?.sizes?.thumbnail?.url || icon?.url) || abs(logo?.sizes?.thumbnail?.url || logo?.url),
  }
}

export function buildSubscriptionMail(
  ctx: TenantNoticeCtx,
  kind: SubscriptionNoticeKind,
  args: {
    tierId: number | string | null
    tierName: string
    priceRub: number | null
    until: string
    autoRenew: boolean
    name?: string | null
  },
) {
  const siteUrl = `https://${ctx.domain}`
  const daysLeft = Math.max(1, Math.ceil((new Date(args.until).getTime() - Date.now()) / 86_400_000))
  return subscriptionNoticeEmail({
    brand: ctx.brand,
    kind,
    authorName: ctx.name,
    avatarUrl: ctx.avatarUrl,
    tierName: args.tierName,
    priceRub: args.priceRub,
    until: args.until,
    daysLeft,
    autoRenew: args.autoRenew,
    renewUrl: args.tierId != null ? `${siteUrl}/subscribe?tier=${encodeURIComponent(String(args.tierId))}` : `${siteUrl}/subscribe`,
    accountUrl: `${siteUrl}/account/subscription`,
    name: args.name,
  })
}

/**
 * Тест: оба письма («через 3 дня» и «закончилась») на указанный адрес с первым
 * активным тарифом тенанта. Возвращает темы отправленных писем.
 */
export async function sendSubscriptionNoticeTest(payload: Payload, tenantId: number, to: string): Promise<string[]> {
  const ctx = await loadTenantNoticeCtx(payload, tenantId)
  if (!ctx) throw new Error('У проекта не задан домен')
  const tier = (
    await payload.find({
      collection: 'subscription-tiers',
      where: { and: [{ tenant: { equals: tenantId } }, { isActive: { equals: true } }] },
      sort: 'weight',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
  ).docs[0] as any
  const base = {
    tierId: tier?.id ?? null,
    tierName: tier?.name || 'Подписка',
    priceRub: Number(tier?.priceRub) || null,
    autoRenew: false,
  }
  const soon = new Date(Date.now() + REMIND_DAYS * 86_400_000).toISOString()
  const past = new Date(Date.now() - 3_600_000).toISOString()
  const sent: string[] = []
  for (const [kind, until] of [['reminder', soon], ['expired', past]] as const) {
    const mail = buildSubscriptionMail(ctx, kind, { ...base, until })
    await payload.sendEmail({ to, subject: `[ТЕСТ] ${mail.subject}`, html: mail.html })
    sent.push(mail.subject)
  }
  return sent
}
