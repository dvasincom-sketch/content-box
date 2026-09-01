import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantFromHeaders } from '@/lib/tenant'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { brandVars } from '@/lib/brand'
import { buildMetadata } from '@/lib/seo'
import { PerkIcon, type PerkType } from '@/components/studio/PerkIcon'
import { GiftWidget } from '@/components/GiftWidget'
import { SubscribeButton } from './SubscribeButton'
import { planChange, type SubState, type SubChangePlan } from '@/lib/subscriptionChange'
import type { Metadata } from 'next'
import '../styles.css'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getTenantFromHeaders()
  if (!ctx) return {}
  const { tenant, settings } = ctx
  return buildMetadata({
    defaults: settings?.seoDefaults,
    fallbackTitle: 'Подписка',
    brandName: tenant.name,
  })
}

type Perk = { type: PerkType; text: string }
type Tier = {
  id: number | string
  name: string
  priceRub: number
  description: string
  badge: string | null
  perks: Perk[]
  weight: number
}

export default async function SubscribePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>
  const { tenant, settings } = ctx

  const sp = await searchParams
  const focusTierId = typeof sp?.tier === 'string' ? sp.tier : ''

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
    badge: typeof t.badge === 'string' && t.badge.trim() ? t.badge.trim() : null,
    weight: t.weight,
    perks: Array.isArray(t.perks)
      ? t.perks.map((p: any) => ({ type: (p.type || 'included') as PerkType, text: p.text || '' }))
      : [],
  }))

  // Текущее состояние подписки (если вошёл) — для расчёта апгрейд/даунгрейд.
  const sub = await getCurrentSubscriber(tenant.id).catch(() => null)
  const now = new Date()
  let subState: SubState = { activeTierId: null, activePriceRub: 0, until: null }
  if (sub) {
    const v = (sub as any).activeTier
    const activeTierId = ((): number | null => {
      const id = v && typeof v === 'object' ? v.id : v
      return id != null ? Number(id) : null
    })()
    const until = (sub as any).subscriptionUntil ? new Date((sub as any).subscriptionUntil) : null
    const activePriceRub = activeTierId != null ? Number(tiers.find((t) => String(t.id) === String(activeTierId))?.priceRub || 0) : 0
    subState = { activeTierId, activePriceRub, until }
  }

  const focusTier = focusTierId ? tiers.find((t) => String(t.id) === focusTierId) : undefined

  return (
    <main
      style={{
        ...brandVars(settings),
        background: 'var(--brand-bg)',
        minHeight: '100vh',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-12">
        <nav
          className="text-sm mb-8 flex items-center gap-x-2"
          style={{ color: 'var(--brand-muted)' }}
        >
          <Link href="/" className="c-navlink">Главная</Link>
          <span aria-hidden="true">/</span>
          <span style={{ color: 'var(--brand-text)' }}>Подписка</span>
        </nav>

        {focusTier ? (
          <>
            <header className="text-center mb-8">
              <h1 className="text-3xl lg:text-4xl font-extrabold mb-3" style={{ color: 'var(--brand-text)' }}>
                Вы выбрали уровень «{focusTier.name}»
              </h1>
              <p className="text-base max-w-xl mx-auto" style={{ color: 'var(--brand-muted)', textAlign: 'center', marginLeft: 'auto', marginRight: 'auto', textWrap: 'balance' }}>
                Подтвердите оформление. Оплата картами РФ, подписку можно отменить в любой момент.
              </p>
            </header>
            <div className="sub-grid sub-grid--one">
              <TierCard tier={focusTier} highlighted plan={planChange({ id: focusTier.id, priceRub: focusTier.priceRub }, subState, now)} />
            </div>
            <p className="text-center text-sm mt-8">
              <Link href="/subscribe" className="c-navlink" style={{ color: 'var(--brand-muted)' }}>← Показать все уровни</Link>
            </p>
          </>
        ) : (
          <>
            <header className="text-center mb-12">
              <h1 className="text-3xl lg:text-5xl font-extrabold mb-4" style={{ color: 'var(--brand-text)' }}>
                Оформить подписку
              </h1>
              <p className="text-base lg:text-lg max-w-2xl mx-auto" style={{ color: 'var(--brand-muted)', textAlign: 'center', marginLeft: 'auto', marginRight: 'auto', textWrap: 'balance' }}>
                Выберите уровень доступа. Высший уровень открывает весь контент уровней ниже.
              </p>
            </header>

            <div className="gift-cta">
              <GiftWidget mode="segment" tiers={tiers.map((t) => ({ id: t.id, name: t.name, priceRub: t.priceRub, description: t.description }))} selfHref="/subscribe" />
              <span className="gift-cta__hint">Можно оформить подписку себе или подарить её другу</span>
            </div>

            {tiers.length === 0 ? (
              <div
                className="text-center py-16 rounded-2xl"
                style={{
                  color: 'var(--brand-muted)',
                  background: 'color-mix(in srgb, var(--brand-primary) 8%, transparent)',
                }}
              >
                Уровни подписки скоро появятся.
              </div>
            ) : (
              <div className="sub-grid">
                {tiers.map((tier) => (
                  <TierCard
                    key={tier.id}
                    tier={tier}
                    highlighted={Boolean(tier.badge)}
                    plan={planChange({ id: tier.id, priceRub: tier.priceRub }, subState, now)}
                  />
                ))}
              </div>
            )}

            <p className="text-center text-sm mt-10" style={{ color: 'var(--brand-muted)' }}>
              Оплата картами РФ. Подписку можно отменить в любой момент.
            </p>
          </>
        )}
      </div>
    </main>
  )
}

function TierCard({ tier, highlighted, plan }: { tier: Tier; highlighted: boolean; plan: SubChangePlan }) {
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
      {highlighted && tier.badge && (
        <div
          className="sub-card__badge"
          style={{ background: 'var(--brand-primary)', color: '#fff' }}
        >
          {tier.badge}
        </div>
      )}

      <div className="sub-card__name" style={{ color: 'var(--brand-text)' }}>
        {tier.name}
      </div>

      <div className="sub-card__price" style={{ color: 'var(--brand-text)' }}>
        {tier.priceRub}
        <span className="sub-card__price-cur">₽</span>
        <span className="sub-card__price-per" style={{ color: 'var(--brand-muted)' }}>/мес</span>
      </div>

      {tier.description && (
        <p className="sub-card__desc" style={{ color: 'var(--brand-muted)' }}>
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
                    perk.type === 'excluded'
                      ? 'var(--brand-muted)'
                      : perk.type === 'warning'
                        ? 'var(--warn)'
                        : perk.type === 'star'
                          ? 'var(--brand-accent)'
                          : 'var(--brand-primary)',
                }}
              >
                <PerkIcon type={perk.type} size={18} />
              </span>
              <span
                className="sub-card__perk-text"
                style={perk.type === 'excluded' ? { color: 'var(--brand-muted)' } : undefined}
              >
                {perk.text}
              </span>
            </li>
          ))}
        </ul>
      )}

      <SubscribeButton
        tierId={tier.id}
        plan={plan}
        className={`c-btn c-btn--block c-spotlight${highlighted ? ' c-btn--primary c-spotlight-bright' : ' c-btn--outline'}`}
      />
    </div>
  )
}
