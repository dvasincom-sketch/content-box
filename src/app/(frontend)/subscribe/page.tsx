import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { buildMetadata } from '@/lib/seo'
import { PerkIcon, type PerkType } from '@/components/studio/PerkIcon'
import type { Metadata } from 'next'
import '../styles.css'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getTenantFromHeaders()
  if (!ctx) return {}
  const { tenant, settings } = ctx
  return buildMetadata({
    defaults: (settings as any)?.seoDefaults,
    fallbackTitle: 'Подписка',
    brandName: (tenant as any)?.name,
  })
}

type Perk = { type: PerkType; text: string }
type Tier = {
  id: number | string
  name: string
  priceRub: number
  description: string
  perks: Perk[]
  weight: number
}

export default async function SubscribePage() {
  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>
  const { tenant, settings } = ctx

  const payload = await getPayload({ config: await config })
  const res = await payload.find({
    collection: 'subscription-tiers',
    where: {
      and: [{ tenant: { equals: tenant.id } }, { isActive: { equals: true } }],
    },
    sort: 'weight',
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })

  const tiers: Tier[] = (res.docs as any[]).map((t) => ({
    id: t.id,
    name: t.name,
    priceRub: t.priceRub,
    description: t.description || '',
    weight: t.weight,
    perks: Array.isArray(t.perks)
      ? t.perks.map((p: any) => ({ type: (p.type || 'included') as PerkType, text: p.text || '' }))
      : [],
  }))

  // Акцент — на среднем тарифе (по позиции), если их три и больше.
  const highlightIndex = tiers.length >= 3 ? 1 : -1

  return (
    <main
      style={{
        ...brandVars(settings?.theme, settings?.typography),
        background: 'var(--brand-bg)',
        minHeight: '100vh',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-12">
        <nav
          className="text-sm mb-8 flex items-center gap-x-2"
          style={{ color: 'var(--brand-text)', opacity: 0.7 }}
        >
          <Link href="/" className="hover:opacity-100">Главная</Link>
          <span aria-hidden="true">/</span>
          <span style={{ opacity: 1 }}>Подписка</span>
        </nav>

        <header className="text-center mb-12">
          <h1
            className="text-3xl lg:text-5xl font-extrabold mb-4"
            style={{ color: 'var(--brand-text)' }}
          >
            Оформить подписку
          </h1>
          <p
            className="text-base lg:text-lg max-w-2xl mx-auto"
            style={{ color: 'var(--brand-text)', opacity: 0.75 }}
          >
            Выберите уровень доступа. Высший уровень открывает весь контент уровней ниже.
          </p>
        </header>

        {tiers.length === 0 ? (
          <div
            className="text-center py-16 rounded-2xl"
            style={{
              color: 'var(--brand-text)',
              opacity: 0.7,
              background: 'color-mix(in srgb, var(--brand-primary) 8%, transparent)',
            }}
          >
            Уровни подписки скоро появятся.
          </div>
        ) : (
          <div className="sub-grid">
            {tiers.map((tier, i) => (
              <TierCard key={tier.id} tier={tier} highlighted={i === highlightIndex} />
            ))}
          </div>
        )}

        <p
          className="text-center text-sm mt-10"
          style={{ color: 'var(--brand-text)', opacity: 0.6 }}
        >
          Оплата картами РФ. Подписку можно отменить в любой момент.
        </p>
      </div>
    </main>
  )
}

function TierCard({ tier, highlighted }: { tier: Tier; highlighted: boolean }) {
  return (
    <div
      className={`sub-card${highlighted ? ' sub-card--hl' : ''}`}
      style={{
        background: 'var(--brand-surface)',
        border: highlighted
          ? '2px solid var(--brand-primary)'
          : '1px solid var(--brand-border)',
        boxShadow: 'var(--brand-card-shadow)',
      }}
    >
      {highlighted && (
        <div
          className="sub-card__badge"
          style={{ background: 'var(--brand-primary)', color: '#fff' }}
        >
          Популярный
        </div>
      )}

      <div className="sub-card__name" style={{ color: 'var(--brand-text)' }}>
        {tier.name}
      </div>

      <div className="sub-card__price" style={{ color: 'var(--brand-text)' }}>
        {tier.priceRub}
        <span className="sub-card__price-cur">₽</span>
        <span className="sub-card__price-per" style={{ opacity: 0.6 }}>/мес</span>
      </div>

      {tier.description && (
        <p className="sub-card__desc" style={{ color: 'var(--brand-text)', opacity: 0.7 }}>
          {tier.description}
        </p>
      )}

      {tier.perks.length > 0 && (
        <ul className="sub-card__perks">
          {tier.perks.map((perk, i) => (
            <li
              key={i}
              className="sub-card__perk"
              style={{ color: 'var(--brand-text)' }}
            >
              <span
                className="sub-card__perk-icon"
                style={{
                  color:
                    perk.type === 'warning'
                      ? '#e0a800'
                      : perk.type === 'star'
                        ? 'var(--brand-accent)'
                        : 'var(--brand-primary)',
                }}
              >
                <PerkIcon type={perk.type} size={18} />
              </span>
              <span className="sub-card__perk-text">{perk.text}</span>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/subscribe/soon"
        className="sub-card__btn"
        style={
          highlighted
            ? { background: 'var(--brand-primary)', color: '#fff' }
            : {
                background: 'transparent',
                color: 'var(--brand-text)',
                border: '1px solid var(--brand-border)',
              }
        }
      >
        Оформить
      </Link>
    </div>
  )
}
