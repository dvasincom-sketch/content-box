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

/** Короткие подписи соцсетей (для чипов). */
const SOCIAL_LABEL: Record<string, string> = {
  boosty: 'Boosty',
  vk: 'VK',
  telegram: 'Telegram',
  youtube: 'YouTube',
  instagram: 'Instagram',
}

/** Число с разделителями тысяч; таб. цифры задаёт стиль. */
function fmt(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n)
}

function price(priceRub: number): string {
  return priceRub > 0 ? `${fmt(priceRub)} ₽/мес` : 'Бесплатно'
}

/**
 * «Об авторе и подписка» — спотлайт проекта: аватар/лого, bio, статистика,
 * соцсети и уровни подписки с CTA. Данные собираются в page.tsx из тенанта,
 * настроек и коллекции тарифов (пер-тенант). Секция самоскрывается, если нет
 * ни имени, ни контента.
 */
export function AuthorSpotlightBlock({
  name,
  bio,
  logoUrl,
  stats,
  socials,
  tiers,
  subscribeHref,
}: AuthorSpotlightBlockProps) {
  if (!name && stats.length === 0 && tiers.length === 0) return null

  // Выделяем «рекомендуемый» тариф: первый платный, иначе средний.
  const featIdx =
    tiers.length > 0
      ? (() => {
          const paid = tiers.findIndex((t) => t.priceRub > 0)
          return paid >= 0 ? paid : Math.min(1, tiers.length - 1)
        })()
      : -1

  const validSocials = socials.filter((s) => s && s.url)

  return (
    <section className="mt-10">
      <div className="c-card p-6 lg:p-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-start">
        {/* Автор */}
        <div className="flex flex-col">
          <div className="flex items-start gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={name}
                className="h-16 w-16 rounded-2xl object-cover shrink-0"
                style={{ boxShadow: 'var(--elev-2)' }}
              />
            ) : (
              <div
                className="h-16 w-16 rounded-2xl shrink-0"
                style={{
                  background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-accent))',
                  boxShadow: 'var(--elev-2)',
                }}
                aria-hidden="true"
              />
            )}
            <div className="min-w-0">
              <h2
                className="text-2xl lg:text-3xl font-bold leading-tight"
                style={{ color: 'var(--brand-text)', fontFamily: 'var(--font-heading)', fontWeight: 'var(--heading-weight)' as any }}
              >
                {name}
              </h2>
              {bio && (
                <p className="mt-2 text-sm lg:text-base leading-relaxed" style={{ color: 'var(--brand-muted)' }}>
                  {bio}
                </p>
              )}
            </div>
          </div>

          {stats.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
              {stats.map((s, i) => (
                <div key={i}>
                  <div className="text-2xl font-bold leading-none" style={{ color: 'var(--brand-text)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(s.n)}
                  </div>
                  <div className="mt-1 text-xs lg:text-sm" style={{ color: 'var(--brand-muted)' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {validSocials.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {validSocials.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="c-card--interactive px-3 py-1.5 text-xs font-semibold rounded-full"
                  style={{ color: 'var(--brand-text)', border: '1px solid var(--brand-border)' }}
                >
                  {SOCIAL_LABEL[s.platform] ?? s.platform}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Подписка */}
        <div className="flex flex-col">
          <div className="text-sm font-semibold mb-3" style={{ color: 'var(--brand-muted)' }}>
            Подписка
          </div>

          {tiers.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tiers.slice(0, 3).map((t, i) => {
                const featured = i === featIdx
                return (
                  <div
                    key={i}
                    className="rounded-2xl p-4 flex flex-col"
                    style={{
                      background: featured
                        ? 'color-mix(in srgb, var(--brand-primary) 6%, var(--glass-2))'
                        : 'var(--glass-2)',
                      border: featured
                        ? '1px solid color-mix(in srgb, var(--brand-primary) 55%, var(--brand-border))'
                        : '1px solid var(--brand-border)',
                    }}
                  >
                    <div className="text-sm font-semibold" style={{ color: 'var(--brand-text)' }}>
                      {t.name}
                    </div>
                    <div className="mt-1 mb-3 text-lg font-bold" style={{ color: 'var(--brand-text)', fontVariantNumeric: 'tabular-nums' }}>
                      {price(t.priceRub)}
                    </div>
                    {t.perks.length > 0 && (
                      <ul className="flex flex-col gap-1.5 mb-4">
                        {t.perks.map((p, j) => (
                          <li key={j} className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--brand-muted)' }}>
                            <Check size={13} style={{ color: 'var(--brand-primary)', marginTop: 2, flexShrink: 0 }} />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <AppLink
                      href={subscribeHref}
                      className="mt-auto text-center text-sm font-semibold rounded-xl px-3 py-2"
                      style={
                        featured
                          ? { background: 'var(--brand-primary)', color: '#fff' }
                          : { border: '1px solid var(--brand-border)', color: 'var(--brand-text)' }
                      }
                    >
                      Оформить
                    </AppLink>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="c-card p-5 flex flex-col items-start gap-3">
              <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
                Открой полный доступ к материалам проекта.
              </p>
              <AppLink
                href={subscribeHref}
                className="text-center text-sm font-semibold rounded-xl px-4 py-2"
                style={{ background: 'var(--brand-primary)', color: '#fff' }}
              >
                Оформить подписку
              </AppLink>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
