/**
 * Разовый сид: публикация-профиль «j-hope» (шаблон 'profile') с ПОЛНЫМ текстом.
 * Содержимое (18 разделов из документа) берётся из scripts/jhope-profile.json
 * и записывается в publications.profile как blocks[] — ничего не сокращаем.
 * Картинки (портрет=обложка, галерея, видео) добавляются вручную в студии.
 *
 * Запуск:
 *   node --env-file=.env --import=tsx scripts/seed-jhope-profile.ts [subdomain]
 * Тенант: аргумент/ENV SEED_TENANT (subdomain) → иначе домен *btsrussia* → иначе первый.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const SLUG = 'j-hope'
const __dir = dirname(fileURLToPath(import.meta.url))
const profile = JSON.parse(readFileSync(join(__dir, 'jhope-profile.json'), 'utf8'))
const LEAD: string = profile.lead || 'j-hope — рэпер, танцор и продюсер BTS.'

const lexical = {
  root: { type: 'root', format: '', indent: 0, version: 1, direction: null as any,
    children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: null as any,
      children: [{ type: 'text', text: LEAD, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }] }] },
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

  const existing = await payload.find({
    collection: 'publications',
    where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: SLUG } }] },
    limit: 1, depth: 0, overrideAccess: true,
  })

  const data: any = {
    title: 'j-hope', slug: SLUG, tenant: tenant.id,
    template: 'profile', profile, description: lexical,
    publishedAt: existing.docs[0]?.publishedAt || new Date().toISOString(),
  }
  if (owner && !existing.docs.length) data.owner = owner.id

  if (existing.docs.length) {
    await payload.update({ collection: 'publications', id: (existing.docs[0] as any).id, data, overrideAccess: true })
    console.log(`Обновлена публикация /publication/${SLUG} (блоков: ${profile.blocks?.length ?? 0})`)
  } else {
    const doc = await payload.create({ collection: 'publications', data, overrideAccess: true })
    console.log(`Создана публикация /publication/${SLUG} (id=${(doc as any).id}, блоков: ${profile.blocks?.length ?? 0})`)
  }
  console.log('Готово. Портрет (обложка), галерею и видео добавьте в студии.')
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
