import { getPayload } from 'payload'
import config from '@payload-config'

const richText = (text: string) => ({
  root: {
    type: 'root', format: '' as const, indent: 0, version: 1, direction: 'ltr' as const,
    children: [{
      type: 'paragraph', format: '' as const, indent: 0, version: 1, direction: 'ltr' as const,
      children: [{ type: 'text', text, format: 0, style: '', mode: 'normal' as const, detail: 0, version: 1 }],
    }],
  },
})

const TENANT = 1
const SOCIALS = [
  { platform: 'boosty', url: 'https://boosty.to/cocojambo' },
  { platform: 'telegram', url: 'https://t.me/cocojambo' },
  { platform: 'vk', url: 'https://vk.com/cocojambo' },
  { platform: 'youtube', url: 'https://youtube.com/@cocojambo' },
  { platform: 'instagram', url: 'https://instagram.com/cocojambo' },
]
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString() }

const categories = [
  { title: 'Концерты', slug: 'concerts', order: 1 },
  { title: 'Weverse Live', slug: 'weverse-live', order: 2 },
  { title: 'RUN BTS', slug: 'run-bts', order: 3 },
  { title: 'Bon Voyage', slug: 'bon-voyage', order: 4 },
  { title: 'In The Soop', slug: 'in-the-soop', order: 5 },
  { title: 'Документальные фильмы', slug: 'documentaries', order: 6 },
  { title: 'Аудиофайлы', slug: 'audio', order: 7 },
]

const publications = [
  { title: 'За кадром: World Tour «Arirang» в Токио', slug: 'arirang-tokyo-behind', publishedAt: daysAgo(0), featured: true, category: 'concerts',
    sources: [
      { type: 'external' as const, platform: 'boosty' as const, url: 'https://boosty.to/example/1' },
      { type: 'external' as const, platform: 'vk' as const, url: 'https://vk.com/video_example_1' },
      { type: 'external' as const, platform: 'telegram' as const, url: 'https://t.me/example/1' },
    ] },
  { title: 'В поисках Кани — эп. 40', slug: 'searching-for-kani-40', publishedAt: daysAgo(0), featured: false, category: 'run-bts',
    sources: [
      { type: 'external' as const, platform: 'boosty' as const, url: 'https://boosty.to/example/2' },
      { type: 'external' as const, platform: 'vk' as const, url: 'https://vk.com/video_example_2' },
      { type: 'external' as const, platform: 'telegram' as const, url: 'https://t.me/example/2' },
    ] },
  { title: 'RUN BTS! — эпизод 156', slug: 'run-bts-156', publishedAt: daysAgo(1), featured: false, category: 'run-bts',
    sources: [
      { type: 'external' as const, platform: 'boosty' as const, url: 'https://boosty.to/example/3' },
      { type: 'external' as const, platform: 'vk' as const, url: 'https://vk.com/video_example_3' },
      { type: 'external' as const, platform: 'telegram' as const, url: 'https://t.me/example/3' },
    ] },
  { title: 'Jimin перед показом Dior в Париже', slug: 'jimin-dior-paris', publishedAt: daysAgo(3), featured: false, category: 'concerts',
    sources: [
      { type: 'external' as const, platform: 'boosty' as const, url: 'https://boosty.to/example/4' },
      { type: 'external' as const, platform: 'vk' as const, url: 'https://vk.com/video_example_4' },
      { type: 'external' as const, platform: 'telegram' as const, url: 'https://t.me/example/4' },
    ] },
]

async function run() {
  const payload = await getPayload({ config })

  // ---- Категории ----
  const catIdBySlug: Record<string, number> = {}
  for (const c of categories) {
    const existing = await payload.find({
      collection: 'categories',
      where: { and: [{ tenant: { equals: TENANT } }, { slug: { equals: c.slug } }] },
      limit: 1, overrideAccess: true, depth: 0,
    })
    if (existing.docs.length > 0) {
      catIdBySlug[c.slug] = existing.docs[0].id as number
      console.log(`↷ категория есть: ${c.slug}`)
      continue
    }
    const created = await payload.create({
      collection: 'categories', overrideAccess: true,
      data: { tenant: TENANT, title: c.title, slug: c.slug, order: c.order } as any,
    })
    catIdBySlug[c.slug] = created.id as number
    console.log(`✓ категория: ${c.title}`)
  }

  // ---- Публикации ----
  for (const p of publications) {
    const existing = await payload.find({
      collection: 'publications',
      where: { and: [{ tenant: { equals: TENANT } }, { slug: { equals: p.slug } }] },
      limit: 1, overrideAccess: true, depth: 0,
    })
    if (existing.docs.length > 0) { console.log(`↷ публикация есть: ${p.slug}`); continue }
    await payload.create({
      collection: 'publications', overrideAccess: true,
      data: {
        tenant: TENANT, category: catIdBySlug[p.category], title: p.title, slug: p.slug,
        publishedAt: p.publishedAt, featured: p.featured,
        description: richText(p.title), sources: p.sources,
      } as any,
    })
    console.log(`✓ публикация: ${p.title}`)
  }

  const ss = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: TENANT } }, limit: 1, overrideAccess: true, depth: 0,
  })
  const ssDoc = ss.docs[0] as any
  if (ssDoc) {
    if (!ssDoc.socials || ssDoc.socials.length === 0) {
      await payload.update({
        collection: 'site-settings', id: ssDoc.id, overrideAccess: true,
        data: { socials: SOCIALS } as any,
      })
      console.log('socials записаны: ' + SOCIALS.length)
    } else {
      console.log('socials уже есть: ' + ssDoc.socials.length)
    }
  } else {
    console.log('SiteSettings не найдены')
  }

  console.log('Готово.')
  process.exit(0)
}

run().catch((err) => { console.error(err); process.exit(1) })
