/**
 * Разовый сид: ПОЛНЫЕ профили 6 участников BTS (rm/jin/suga/jimin/v/jungkook)
 * из scripts/bts-profiles-full.json — весь текст из документов, без сокращений,
 * в виде blocks[]. Обновляет уже существующие публикации по slug (не плодит копии).
 * Портрет/галерею/видео добавляйте в студии.
 *
 * Запуск:
 *   node --env-file=.env --import=tsx scripts/seed-bts-profiles-full.ts [subdomain]
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const __dir = dirname(fileURLToPath(import.meta.url))
const bundle = JSON.parse(readFileSync(join(__dir, 'bts-profiles-full.json'), 'utf8')) as Record<string, any>

const TITLES: Record<string, string> = {
  rm: 'RM', jin: 'Jin', suga: 'SUGA', jimin: 'Jimin', v: 'V', jungkook: 'Jung Kook',
}

function leadLexical(lead: string) {
  return {
    root: { type: 'root', format: '', indent: 0, version: 1, direction: null as any,
      children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: null as any,
        children: [{ type: 'text', text: lead, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }] }] },
  }
}

async function main() {
  const payload = await getPayload({ config: await (config as any) })
  const want = (process.argv[2] || process.env.SEED_TENANT || '').trim()

  const tenants = await payload.find({ collection: 'tenants', limit: 100, depth: 0, overrideAccess: true })
  let tenant: any = null
  if (want) tenant = (tenants.docs as any[]).find((t) => String(t.subdomain) === want || String(t.domain).includes(want))
  if (!tenant) tenant = (tenants.docs as any[]).find((t) => String(t.domain || '').includes('btsrussia'))
  if (!tenant) tenant = (tenants.docs as any[])[0]
  if (!tenant) { console.error('Тенант не найден'); process.exit(1) }
  console.log(`Тенант: ${tenant.name} (${tenant.subdomain}/${tenant.domain}) id=${tenant.id}`)

  const owner = (await payload.find({ collection: 'users', where: { tenant: { equals: tenant.id } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as any

  for (const slug of Object.keys(bundle)) {
    const profile = bundle[slug]
    const title = TITLES[slug] || slug
    const existing = await payload.find({
      collection: 'publications',
      where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: slug } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    const data: any = {
      title, slug, tenant: tenant.id,
      template: 'profile', profile, description: leadLexical(profile.lead || title),
      publishedAt: existing.docs[0]?.publishedAt || new Date().toISOString(),
    }
    if (owner && !existing.docs.length) data.owner = owner.id
    const n = profile.blocks?.length ?? 0
    if (existing.docs.length) {
      await payload.update({ collection: 'publications', id: (existing.docs[0] as any).id, data, overrideAccess: true })
      console.log(`  ✓ обновлён /publication/${slug} (блоков: ${n})`)
    } else {
      const doc = await payload.create({ collection: 'publications', data, overrideAccess: true })
      console.log(`  + создан /publication/${slug} (id=${(doc as any).id}, блоков: ${n})`)
    }
  }
  console.log('Готово. Портреты (обложки), галереи и видео добавьте в студии.')
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
