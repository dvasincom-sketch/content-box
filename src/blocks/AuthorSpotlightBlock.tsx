import React from 'react'
import AppLink from '@/components/AppLink'
import { Check } from 'lucide-react'

export type SpotlightStat = { n: number; label: string }
export type SpotlightSocial = { platform: string; url: string }
export type SpotlightTier = { name: string; priceRub: number; perks: string[] }

export type AuthorSpotlightBlockProps = {
  name: string
  bio: string | null
  logoUrl: string | null
  stats: SpotlightStat[]
  socials: SpotlightSocial[]
  tiers: SpotlightTier[]
  subscribeHref: string
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

  const featIdx =
    tiers.length > 0
      ? (() => {
          const paid = tiers.findIndex((t) => t.priceRub > 0)
          return paid >= 0 ? paid : Math.min(1, tiers.length - 1)
        })()
      : -1
  const validSocials = socials.filter((s) => s && s.url)

  return (
    <section className="mt-10 spot">
      <div className="spot__head c-card">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={name} className="spot__logo" />
        ) : (
          <div className="spot__logo spot__logo--ph" aria-hidden />
        )}
        <div className="spot__id">
          <h2 className="spot__name">{name}</h2>
          {bio && <p className="spot__bio">{bio}</p>}
        </div>
        {stats.length > 0 && (
          <div className="spot__stats">
            {stats.map((s, i) => (
              <div key={i} className="spot__stat">
                <div className="spot__stat-n">{fmt(s.n)}</div>
                <div className="spot__stat-l">{s.label}</div>
              </div>
            ))}
          </div>
        )}
        {validSocials.length > 0 && (
          <div className="spot__socials">
            {validSocials.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="spot__social">
                {SOCIAL_LABEL[s.platform] ?? s.platform}
              </a>
            ))}
          </div>
        )}
      </div>

      {tiers.length > 0 && (
        <div className="spot__subs">
          <div className="spot__subs-label">Подписка</div>
          <div className="spot__tiers" data-count={Math.min(tiers.length, 3)}>
            {tiers.slice(0, 3).map((t, i) => {
              const featured = i === featIdx
              return (
                <div key={i} className={'spot__tier' + (featured ? ' is-feat' : '')}>
                  {featured && <span className="spot__badge">Популярно</span>}
                  <div className="spot__tier-name">{t.name}</div>
                  <div className="spot__tier-price">{price(t.priceRub)}</div>
                  {t.perks.length > 0 && (
                    <ul className="spot__perks">
                      {t.perks.map((p, j) => (
                        <li key={j}>
                          <Check size={15} className="spot__check" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <AppLink href={subscribeHref} className={'spot__btn' + (featured ? ' is-feat' : '')}>
                    Оформить
                  </AppLink>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
