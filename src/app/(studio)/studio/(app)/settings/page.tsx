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
import { redirect } from 'next/navigation'
import { requireAuthor } from '@/lib/currentAuthor'
import { capabilitiesOf } from '@/access'
import { hasCap, SETTINGS_MANAGE_KEYS } from '@/lib/permissions'
import { normalizeHomeSections } from '@/lib/homeSections'
import { SettingsView } from './SettingsView'
import { getAiUsageStats, type AiUsageStats } from '@/lib/aiUsageStats'
import { getMediaStats } from '@/lib/mediaStats'
import { getCommerceStats } from '@/lib/commerceStats'
import { computeTariff } from '@/lib/tariff'
import type { TariffPanelData } from './TariffPanel'

/**
 * Экран «Настройки» (студия): логотип, соцсети, уровни подписки, тема студии.
 * Серверная часть грузит site-settings (одна запись на тенант) и уровни.
 */

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const author = await requireAuthor()
  const isOwnerEarly = (author!.user as { tenantRole?: string | null }).tenantRole !== 'contributor'
  const abilities = capabilitiesOf(author!.user as any)
  if (!isOwnerEarly && !SETTINGS_MANAGE_KEYS.some((k) => hasCap(abilities, k, 'manage'))) redirect('/studio')
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
  const appIcon = settings?.appIcon
  const appIconUrl = appIcon && typeof appIcon === 'object' ? appIcon.url : null
  const ogImg = settings?.seoDefaults?.ogImage
  const ogImageUrl = ogImg && typeof ogImg === 'object' ? ogImg.url : null

  const socials = Array.isArray(settings?.socials)
    ? settings.socials.map((s: any) => ({ platform: s.platform, url: s.url }))
    : []

  // Конфиг секций главной: порядок + видимость. Нормализуем здесь, чтобы вкладка
  // всегда получала валидный набор (пустой/битый → дефолт из всех секций).
  const homeSections = normalizeHomeSections(settings?.homeSections)
  const savedTemplates = Array.isArray(settings?.savedTemplates) ? (settings.savedTemplates as any[]) : []
  const appliedTemplate = (settings?.appliedTemplate as string | null) ?? null
  const bgDecor = ((settings as { bgDecor?: string } | null)?.bgDecor as string | null) ?? null
  const donatePresets = Array.isArray((settings as { donatePresets?: unknown } | null)?.donatePresets)
    ? ((settings as { donatePresets: { amount?: unknown; label?: unknown }[] }).donatePresets).map((p) => ({ amount: Number(p.amount) || 0, label: String(p.label ?? '') }))
    : []

  const tiers = (tiersRes.docs as any[]).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug || '',
    weight: t.weight,
    priceRub: t.priceRub,
    description: t.description || '',
    badge: t.badge || '',
    isActive: t.isActive !== false,
    perks: Array.isArray(t.perks)
      ? t.perks.map((p: any) => ({ type: p.type || 'included', text: p.text || '' }))
      : [],
  }))

  // Цели сбора (вкладка «Подписки», страница «Поддержать проект»).
  const goalsRes = await payload.find({
    collection: 'support-goals',
    where: { tenant: { equals: author!.tenantId } },
    sort: 'weight',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  const goals = (goalsRes.docs as any[]).map((g) => ({
    id: g.id,
    title: g.title || '',
    description: g.description || '',
    targetRub: Number(g.targetRub) || 0,
    raisedRub: Number(g.raisedRub) || 0,
    weight: Number(g.weight) || 0,
    isActive: g.isActive !== false,
    slug: g.slug || '',
  }))

  // Участники тенанта (вкладка «Доступ», видна только владельцу).
  const usersRes = await payload.find({
    collection: 'users',
    where: { tenant: { equals: author!.tenantId } },
    limit: 100, depth: 0, overrideAccess: true,
  })
  const selfId = author!.user.id
  const isOwner = (author!.user as { tenantRole?: string | null }).tenantRole !== 'contributor'
  const members = (usersRes.docs as any[]).map((u) => {
    const pending = !!u.inviteTokenHash && !u.inviteAcceptedAt
    const expired = pending && u.inviteExpiresAt ? new Date(u.inviteExpiresAt).getTime() < Date.now() : false
    const status = u.tenantRole !== 'contributor' ? 'owner' : u.disabled ? 'disabled' : expired ? 'expired' : pending ? 'pending' : 'active'
    return { id: u.id, email: u.email as string, name: (u.name as string) || '', status, isSelf: Number(u.id) === Number(selfId), studioRole: (u.studioRole as string) || null, capabilities: (u.capabilities as any) || null }
  })

  // Данные раздела «Тариф» (только владельцу): занятое место, MRR, дата создания
  // проекта для триала — считаем расчётный платформенный сбор.
  let tariff: TariffPanelData | null = null
  let aiUsage: AiUsageStats | null = null
  if (isOwner) {
    aiUsage = await getAiUsageStats(payload, author!.tenantId)
    const [mediaStats, commerce, tenantDoc] = await Promise.all([
      getMediaStats(payload, author!.tenantId),
      getCommerceStats(payload, author!.tenantId),
      payload.findByID({ collection: 'tenants', id: author!.tenantId, depth: 0, overrideAccess: true }).catch(() => null),
    ])
    if (mediaStats) {
      const mrrRub = commerce?.mrr ?? 0
      tariff = {
        tariff: computeTariff({ bytes: mediaStats.bytes, mrrRub, createdAt: (tenantDoc as { createdAt?: string } | null)?.createdAt ?? null }),
        sources: mediaStats.sources,
        mrrRub,
      }
    }
  }

  return (
    <SettingsView
      logoUrl={logoUrl}
      appIconUrl={appIconUrl}
      ogImageUrl={ogImageUrl}
      socials={socials}
      tiers={tiers}
      homeSections={homeSections}
      savedTemplates={savedTemplates}
      appliedTemplate={appliedTemplate}
      bgDecor={bgDecor}
      goals={goals}
      donatePresets={donatePresets}
      members={members}
      isOwner={isOwner}
      abilities={abilities}
      tariff={tariff}
      aiUsage={aiUsage}
    />
  )
}
