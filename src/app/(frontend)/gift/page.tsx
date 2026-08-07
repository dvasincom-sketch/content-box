import React from 'react'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { Gift, Mail, Sparkles } from 'lucide-react'
import { GiftWidget, type GiftTier } from '@/components/GiftWidget'
import '../styles.css'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getTenantFromHeaders()
  if (!ctx) return {}
  const { tenant, settings } = ctx
  return buildMetadata({ defaults: settings?.seoDefaults, fallbackTitle: 'Подарить подписку', brandName: tenant.name })
}

export default async function GiftPage() {
  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>
  const { tenant, settings } = ctx

  const payload = await getPayload({ config: await config })
  const res = await payload.find({
    collection: 'subscription-tiers',
    where: { and: [{ tenant: { equals: tenant.id } }, { isActive: { equals: true } }] },
    sort: 'weight', limit: 50, depth: 0, overrideAccess: true,
  })
  const tiers: GiftTier[] = (res.docs as any[])
    .map((t) => ({ id: t.id, name: t.name, priceRub: Number(t.priceRub) || 0, description: t.description || '' }))
  const giftable = tiers.filter((t) => t.priceRub > 0)
  const minPrice = giftable.length ? Math.min(...giftable.map((t) => t.priceRub)) : 0

  const STEPS = [
    { icon: Gift, title: 'Выберите уровень и период', text: 'Любой платный тариф на 1, 3, 6 или 12 месяцев. Можно сразу несколько подарков.' },
    { icon: Mail, title: 'Пришлём ссылку-подарок', text: 'Укажите e-mail получателя сразу или позже — ссылку найдёте в «Мои подписки».' },
    { icon: Sparkles, title: 'Друг активирует подписку', text: 'Получатель переходит по ссылке, входит в аккаунт — и подписка уже у него.' },
  ]

  return (
    <div style={brandVars(settings) as React.CSSProperties}>
      <main style={{ background: 'var(--brand-bg)', minHeight: '100vh' }}>
        <div className="dn-wrap">
          <nav className="dn-crumbs">
            <Link href="/" className="c-navlink">Главная</Link>
            <span aria-hidden>/</span>
            <span style={{ color: 'var(--brand-text)' }}>Подарить подписку</span>
          </nav>

          <header className="dn-hero">
            <div className="dn-hero__body">
              <span className="dn-eyebrow"><Gift size={14} /> Подарок</span>
              <h1 className="dn-hero__title">Подарите подписку {tenant.name || ''}</h1>
              <p className="dn-hero__sub">
                Отличный подарок для фаната: доступ к эксклюзиву, озвучкам и всему контенту проекта.
                {minPrice > 0 && <> От {new Intl.NumberFormat('ru-RU').format(minPrice)} ₽ в месяц.</>}
              </p>
              <div className="gift-hero-cta">
                <GiftWidget mode="button" tiers={tiers} label="Подарить подписку" />
                <Link href="/subscribe" className="dn-btn dn-btn--ghost dn-btn--lg">Оформить себе</Link>
              </div>
            </div>
          </header>

          <section className="dn-section">
            <h2 className="dn-h2">Как это работает</h2>
            <div className="gift-steps">
              {STEPS.map((s, i) => {
                const Icon = s.icon
                return (
                  <div key={i} className="gift-step">
                    <span className="gift-step__i"><Icon size={22} /></span>
                    <span className="gift-step__n">{i + 1}</span>
                    <div className="gift-step__title">{s.title}</div>
                    <p className="gift-step__text">{s.text}</p>
                  </div>
                )
              })}
            </div>
          </section>

          {giftable.length > 0 && (
            <section className="dn-section">
              <h2 className="dn-h2">Что можно подарить</h2>
              <div className="dn-goals">
                {giftable.map((t) => (
                  <div key={t.id} className="dn-goal">
                    <div className="gift-tier__name">{t.name}</div>
                    <div className="gift-tier__price">{new Intl.NumberFormat('ru-RU').format(t.priceRub)} ₽ <span>в месяц</span></div>
                    {t.description && <p className="dn-goal__desc" style={{ marginTop: '.5rem' }}>{t.description}</p>}
                  </div>
                ))}
              </div>
              <div className="gift-mid-cta">
                <GiftWidget mode="button" tiers={tiers} label="Оформить подарок" />
              </div>
            </section>
          )}

          <section className="dn-section">
            <h2 className="dn-h2">Частые вопросы</h2>
            <div className="gift-faq">
              <details className="gift-faq__item"><summary>Нужен ли аккаунт получателю?</summary><p>Да, при активации подарка получатель входит в свой аккаунт или регистрируется — подписка привязывается к нему.</p></details>
              <details className="gift-faq__item"><summary>Что будет после окончания периода?</summary><p>Подписка просто закончится. Продлить её получатель сможет сам, если захочет.</p></details>
              <details className="gift-faq__item"><summary>Можно подарить сразу нескольким?</summary><p>Да — укажите количество и e-mail каждого получателя (или отправьте ссылки позже из «Мои подписки»).</p></details>
              <details className="gift-faq__item"><summary>Можно ли анонимно?</summary><p>Да, включите «Отправить анонимно» — получатель не увидит, от кого подарок.</p></details>
            </div>
          </section>

          <section className="dn-section">
            <div className="gift-final">
              <Gift size={30} />
              <h2>Порадуйте близкого фаната</h2>
              <p>Подписка-подарок придёт на e-mail со ссылкой активации. Оформляется за минуту.</p>
              <GiftWidget mode="button" tiers={tiers} label="Подарить подписку" />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
