'use server'

import { getPayload, type Payload } from 'payload'
import { revalidatePath } from 'next/cache'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { getTenantFromHeaders } from '@/lib/tenant'
import { htmlToLexical, lexicalToPlainText } from '@/lib/lexical'
import { isTrusted } from '@/lib/capabilities'
import { slugify } from '@/lib/slugify'

/* Приём публикаций от участников (UGC, Фаза 4). Заявка идёт в submissions
   (pending). Trusted (L4) — авто-одобрение: сразу создаётся publication.
   Гейт качества — премодерация; трест-гейт на отправку конфигом. */

const MIN_LEVEL_TO_SUBMIT = 0 // 0 = любой зарегистрированный (можно поднять до 2)
const SUBMIT_COOLDOWN_SEC = 120
const MAX_PER_DAY = 5
const TITLE_MAX = 160
const MIN_BODY_LEN = 20
const MAX_LINKS = 3

export type SubmitResult =
  | { ok: true; status: 'pending' | 'published'; slug?: string }
  | { ok: false; error: string }

async function uniqueSlug(payload: Payload, tenantId: number, base: string): Promise<string> {
  let slug = base || 'post'
  let n = 1
  // до 50 попыток, затем суффикс времени
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const ex = await payload.find({
      collection: 'publications',
      where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (ex.docs.length === 0) return slug
    n++
    slug = `${base}-${n}`
    if (n > 50) return `${base}-${n}`
  }
}

export async function createSubmission(input: {
  title: string
  bodyHtml: string
  categoryId?: string | number | null
}): Promise<SubmitResult> {
  const payload = await getPayload({ config: await config })
  const tctx = await getTenantFromHeaders()
  const tenant = (tctx as any)?.tenant
  const subscriber = (await getCurrentSubscriber().catch(() => null)) as any

  if (!tenant?.id) return { ok: false, error: 'Тенант не определён.' }
  if (!subscriber?.id) return { ok: false, error: 'Войдите, чтобы опубликовать.' }
  if (subscriber.isBlocked) return { ok: false, error: 'Действие недоступно.' }
  if ((Number(subscriber.level) || 0) < MIN_LEVEL_TO_SUBMIT) {
    return { ok: false, error: 'Пока недостаточно активности, чтобы публиковать.' }
  }

  const title = (input.title || '').trim().slice(0, TITLE_MAX)
  if (!title) return { ok: false, error: 'Укажите заголовок.' }

  const bodyLex = htmlToLexical(input.bodyHtml || '')
  const plain = lexicalToPlainText(bodyLex)
  if (plain.trim().length < MIN_BODY_LEN) return { ok: false, error: 'Текст слишком короткий.' }
  const linkCount = (input.bodyHtml.match(/https?:\/\//gi) || []).length
  if (linkCount > MAX_LINKS) return { ok: false, error: `Слишком много ссылок (максимум ${MAX_LINKS}).` }

  // Rate-limit: не больше MAX_PER_DAY за сутки + кулдаун.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const recent = await payload.find({
    collection: 'submissions',
    where: {
      and: [
        { author: { equals: subscriber.id } },
        { tenant: { equals: tenant.id } },
        { createdAt: { greater_than: since } },
      ],
    },
    sort: '-createdAt',
    limit: MAX_PER_DAY + 1,
    depth: 0,
    overrideAccess: true,
  })
  if (recent.docs.length >= MAX_PER_DAY) {
    return { ok: false, error: 'Лимит публикаций на сегодня исчерпан.' }
  }
  const last = recent.docs[0] as any
  if (last?.createdAt) {
    const el = (Date.now() - new Date(last.createdAt).getTime()) / 1000
    if (el < SUBMIT_COOLDOWN_SEC) {
      return { ok: false, error: `Подождите ${Math.ceil(SUBMIT_COOLDOWN_SEC - el)} с перед следующей отправкой.` }
    }
  }

  // Категория — только своего тенанта.
  let categoryId: number | null = null
  if (input.categoryId) {
    const cid = Number(input.categoryId)
    const cat = (await payload
      .findByID({ collection: 'categories', id: cid, depth: 0, overrideAccess: true })
      .catch(() => null)) as any
    const cTenant = cat && (typeof cat.tenant === 'object' ? cat.tenant?.id : cat.tenant)
    if (cat && Number(cTenant) === Number(tenant.id)) categoryId = cid
  }

  const trusted = isTrusted(subscriber.level)
  const paid = Boolean(subscriber.activeTier)

  try {
    if (trusted) {
      // Авто-одобрение доверенного: сразу публикация (общая лента только платным).
      const section = paid ? 'feed' : 'community'
      const slug = await uniqueSlug(payload, Number(tenant.id), slugify(title) || 'post')
      const pub = await payload.create({
        collection: 'publications',
        data: {
          title,
          slug,
          tenant: tenant.id,
          description: bodyLex,
          author: subscriber.id,
          section,
          ...(categoryId ? { category: categoryId } : {}),
          publishedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })
      await payload.create({
        collection: 'submissions',
        data: {
          tenant: tenant.id,
          author: subscriber.id,
          title,
          body: bodyLex,
          ...(categoryId ? { category: categoryId } : {}),
          status: 'approved',
          section,
          publication: pub.id,
        } as any,
        overrideAccess: true,
      })
      revalidatePath('/')
      return { ok: true, status: 'published', slug }
    }

    await payload.create({
      collection: 'submissions',
      data: {
        tenant: tenant.id,
        author: subscriber.id,
        title,
        body: bodyLex,
        ...(categoryId ? { category: categoryId } : {}),
        status: 'pending',
      } as any,
      overrideAccess: true,
    })
    return { ok: true, status: 'pending' }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Не удалось отправить.' }
  }
}
