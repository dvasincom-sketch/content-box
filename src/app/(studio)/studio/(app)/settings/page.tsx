import React from 'react'
// Шрифты витрины (для сэмплов в карточках пресетов). Совпадают с фронтендом,
// офлайн через @fontsource; PT Serif — вендорный @font-face.
import '@fontsource-variable/inter'
import '@fontsource-variable/montserrat'
import '@fontsource-variable/manrope'
import '@fontsource-variable/golos-text'
import '@fontsource/pt-sans/400.css'
import '@fontsource/pt-sans/700.css'
import '@fontsource-variable/unbounded'
import '@fontsource-variable/roboto'
import '@/app/(frontend)/pt-serif.css'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { normalizeHomeSections } from '@/lib/homeSections'
import { SettingsView } from './SettingsView'
import { DEFAULT_PRESET_ID } from '@/lib/themePresets'

/**
 * Экран «Настройки» (студия): логотип, соцсети, уровни подписки, тема студии.
 * Серверная часть грузит site-settings (одна запись на тенант) и уровни.
 */

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const author = await getCurrentAuthor()
  const payload = await getPayload({ config: await config })

  const [settingsRes, tiersRes] = await Promise.all([
    payload.find({
      collection: 'site-settings',
      where: { tenant: { equals: author!.tenantId } },
      limit: 1,
      depth: 1, // подтянуть logo (media) для url
      overrideAccess: true,
    }),
    payload.find({
      collection: 'subscription-tiers',
      where: { tenant: { equals: author!.tenantId } },
      sort: 'weight',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const settings = settingsRes.docs[0] as any
  const logo = settings?.logo
  const logoUrl = logo && typeof logo === 'object' ? logo.url : null

  const socials = Array.isArray(settings?.socials)
    ? settings.socials.map((s: any) => ({ platform: s.platform, url: s.url }))
    : []

  // Конфиг секций главной: порядок + видимость. Нормализуем здесь, чтобы вкладка
  // всегда получала валидный набор (пустой/битый → дефолт из всех секций).
  const homeSections = normalizeHomeSections(settings?.homeSections)

  const tiers = (tiersRes.docs as any[]).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug || '',
    weight: t.weight,
    priceRub: t.priceRub,
    description: t.description || '',
    isActive: t.isActive !== false,
    perks: Array.isArray(t.perks)
      ? t.perks.map((p: any) => ({ type: p.type || 'included', text: p.text || '' }))
      : [],
  }))

  return (
    <SettingsView
      logoUrl={logoUrl}
      socials={socials}
      tiers={tiers}
      homeSections={homeSections}
      themePreset={settings?.themePreset ?? DEFAULT_PRESET_ID}
    />
  )
}
