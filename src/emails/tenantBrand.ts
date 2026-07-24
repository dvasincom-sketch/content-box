import { PLATFORM_BRAND, type EmailBrand } from './layout'

/**
 * Бренд письма из данных тенанта и его SiteSettings.
 *
 * Для писем подписчикам (white-label): имя — из tenant.name, акцент/лого — из
 * SiteSettings, ссылка — на публичный домен тенанта. Пустые поля падают на
 * дефолты платформы.
 */

type TenantLike = { name?: string | null; domain?: string | null } | null | undefined

type SettingsLike =
  | {
      theme?: { primary?: string | null } | null
      logo?: number | { url?: string | null } | null
    }
  | null
  | undefined

export function emailBrandForTenant(tenant: TenantLike, settings?: SettingsLike): EmailBrand {
  const name = tenant?.name?.trim() || PLATFORM_BRAND.name
  const color = settings?.theme?.primary?.trim() || PLATFORM_BRAND.color
  const logo = settings?.logo
  const logoUrl = logo && typeof logo === 'object' ? (logo.url ?? null) : null
  const siteUrl = tenant?.domain ? `https://${tenant.domain}` : PLATFORM_BRAND.siteUrl

  return {
    name,
    color,
    logoUrl,
    siteUrl,
    supportEmail: null,
    address: name,
  }
}
