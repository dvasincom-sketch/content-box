import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { HeroBlock } from '@/blocks/HeroBlock'
import { LatestPublicationsBlock } from '@/blocks/LatestPublicationsBlock'
import { CategoriesGridBlock } from '@/blocks/CategoriesGridBlock'
import { WhyUsBlock } from '@/blocks/WhyUsBlock'
import { SocialLinksBlock } from '@/blocks/SocialLinksBlock'
import { BroadcastBannerBlock } from '@/blocks/BroadcastBannerBlock'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import './styles.css'

/** SEO главной (ТЗ §6): только дефолты тенанта, без titleTemplate. */
export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getTenantFromHeaders()
  if (!ctx) return {}
  const { tenant, settings } = ctx
  const defaults = (settings as any)?.seoDefaults

  // На главной шаблон "%s — Бренд" не применяем, иначе выйдет "Бренд — Бренд".
  return buildMetadata({
    defaults: { ...defaults, titleTemplate: null },
    fallbackTitle: (tenant as any)?.name,
    brandName: (tenant as any)?.name,
  })
}

export default async function HomePage() {
  const ctx = await getTenantFromHeaders()
  if (!ctx) {
    return <div className="p-8">Тенант не определён. Открой сайт по адресу тенанта, напр. http://bts.localhost:3000/</div>
  }
  const { tenant, settings } = ctx

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const featuredRes = await payload.find({
    collection: 'publications',
    where: { and: [{ tenant: { equals: tenant.id } }, { featured: { equals: true } }] },
    sort: '-publishedAt', depth: 1, limit: 1, overrideAccess: true,
  })
  const featured = featuredRes.docs[0] as any

  const latestRes = await payload.find({
    collection: 'publications',
    where: { tenant: { equals: tenant.id } },
    sort: '-publishedAt', depth: 1, limit: 8, overrideAccess: true,
  })
  const latest = latestRes.docs as any[]

  const catsRes = await payload.find({
    collection: 'categories',
    where: { tenant: { equals: tenant.id } },
    sort: 'order', depth: 0, limit: 50, overrideAccess: true,
  })
  const categories = catsRes.docs as any[]

  return (
    <main style={{ ...brandVars(settings?.theme, settings?.typography), background: 'var(--brand-bg)', minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <HeroBlock
          eyebrow="BTS TV · 24/7 Broadcast"
          titleLines={['Полные выпуски BTS', 'с русской озвучкой']}
          tags={['Концерты', 'Weverse Live', 'RUN BTS', 'Документальные фильмы']}
          featured={featured ? { title: featured.title, badge: 'Новинка', sources: featured.sources } : null}
        />

        <LatestPublicationsBlock
          items={latest.map((p) => ({
            id: p.id, slug: p.slug, title: p.title, publishedAt: p.publishedAt, sources: p.sources,
          }))}
        />

        <CategoriesGridBlock
          items={categories.map((c) => ({ id: c.id, title: c.title, slug: c.slug }))}
        />

        <WhyUsBlock
          heading="Почему COCO JAMBO"
          items={[
            { icon: 'mic', title: 'Русская озвучка живым голосом', text: 'Качественный перевод и естественная озвучка' },
            { icon: 'screen', title: 'Тысячи часов контента', text: 'Концерты, шоу, лайвы и эксклюзивы' },
            { icon: 'clock', title: 'Новые видео каждую неделю', text: 'Мы постоянно работаем для вас' },
            { icon: 'heart', title: 'Проект от ARMY для ARMY', text: 'С любовью к BTS и каждому зрителю' },
          ]}
        />

        <SocialLinksBlock items={(settings?.socials ?? []) as any[]} />

        <BroadcastBannerBlock tagline="BTS TV" onAirText="ON AIR" />
      </div>
    </main>
  )
}
