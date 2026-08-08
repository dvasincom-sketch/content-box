import React from 'react'
import AppLink from '@/components/AppLink'
import { Check, Play, Camera, Send, Zap, Users, ChevronDown } from 'lucide-react'

export type SpotlightStat = { value: string; label: string }
export type SpotlightSocial = { platform: string; url: string }
export type SpotlightTier = { name: string; priceRub: number; perks: string[]; badge?: string | null; description?: string | null }

export type AuthorSpotlightBlockProps = {
  name: string
  bio: string | null
  logoUrl: string | null
  stats: SpotlightStat[]
  socials: SpotlightSocial[]
  tiers: SpotlightTier[]
  subscribeHref: string
}

const SOCIAL_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  boosty: Zap, telegram: Send, vk: Users, youtube: Play, instagram: Camera,
}
const SOCIAL_LABEL: Record<string, string> = {
  boosty: 'Boosty',
  vk: 'VK',
  telegram: 'Telegram',
  youtube: 'YouTube',
  instagram: 'Instagram',
}

function fmt(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n)
}
function price(priceRub: number): string {
  return priceRub > 0 ? `${fmt(priceRub)} ₽/мес` : 'Бесплатно'
}

/**
 * «Об авторе и подписка» — макет «автор шапкой, тарифы в ряд»: сверху компактная
 * шапка проекта (лого, имя, био, статистика, соцсети в одну строку), ниже —
 * тарифы равными карточками по центру. Рекомендуемый выделен рамкой/бейджем.
 * Преимущества показываются полностью; карточки выравниваются по самой высокой.
 */
export function AuthorSpotlightBlock({ name, bio, logoUrl, stats, socials, tiers, subscribeHref }: AuthorSpotlightBlockProps) {
  if (!name && stats.length === 0 && tiers.length === 0) return null

  const validSocials = socials.filter((s) => s && s.url)
  // Временно скрыт блок «об авторе» над тарифами (лого/био/статы/соцсети).
  const SHOW_HEAD = false

  // Если бейджи не заданы вручную — по умолчанию выделяем первый платный тариф
  // (рамка + яркая кнопка + «Популярно»), чтобы витрина не выглядела плоской.
  const anyBadge = tiers.some((t) => Boolean(t.badge))
  const featIdx = (() => {
    const paid = tiers.findIndex((t) => t.priceRub > 0)
    return paid >= 0 ? paid : Math.min(1, tiers.length - 1)
  })()

  return (
    <section className="mt-10 spot">
      {SHOW_HEAD && (
      <div className="spot__head c-card">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={name} className="spot__logo" />
        ) : (
          <div className="spot__logo spot__logo--ph" aria-hidden />
        )}
        <div className="spot__id">
          {bio && <p className="spot__bio">{bio}</p>}
        </div>
        {stats.length > 0 && (
          <div className="spot__stats">
            {stats.map((s, i) => (
              <div key={i} className="spot__stat">
                <div className="spot__stat-n">{s.value}</div>
                <div className="spot__stat-l">{s.label}</div>
              </div>
            ))}
          </div>
        )}
        {validSocials.length > 0 && (
          <div className="spot__socials">
            {validSocials.map((s, i) => {
              const Icon = SOCIAL_ICON[s.platform]
              const label = SOCIAL_LABEL[s.platform] ?? s.platform
              return (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="spot__social" aria-label={label} title={label}>
                  {Icon ? <Icon size={18} /> : label}
                </a>
              )
            })}
          </div>
        )}
      </div>
      )}

      {tiers.length > 0 && (
        <div className="spot__subs">
          <div className="spot__subs-label">Подписка</div>
          <div className="spot__tiers" data-count={Math.min(tiers.length, 3)}>
            {tiers.slice(0, 3).map((t, i) => {
              const featured = anyBadge ? Boolean(t.badge) : i === featIdx
              const badgeText = t.badge || (featured && !anyBadge ? 'Популярно' : null)
              const TEASER = 4
              const shown = t.perks.slice(0, TEASER)
              const rest = t.perks.slice(TEASER)
              return (
                <div key={i} className={'spot__tier' + (featured ? ' is-feat' : '')}>
                  {badgeText && <span className="spot__badge">{badgeText}</span>}
                  <div className="spot__tier-name">{t.name}</div>
                  <div className="spot__tier-price">{price(t.priceRub)}</div>
                  {t.description && <p className="spot__desc">{t.description}</p>}
                  {shown.length > 0 && (
                    <ul className="spot__perks">
                      {shown.map((p, j) => (
                        <li key={j}>
                          <Check size={15} className="spot__check" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {rest.length > 0 && (
                    <details className="spot__more">
                      <summary className="spot__more-sum">Показать всё ({t.perks.length}) <ChevronDown size={14} /></summary>
                      <ul className="spot__perks spot__perks--extra">
                        {rest.map((p, j) => (
                          <li key={j}>
                            <Check size={15} className="spot__check" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <AppLink href={subscribeHref} className={'spot__btn' + (featured ? ' is-feat' : '')}>
                    Оформить
                  </AppLink>
                </div>
              )
            })}
          </div>
          <AppLink href="/gift" className="spot__gift">🎁 Подарить подписку другу</AppLink>
        </div>
      )}
    </section>
  )
}
