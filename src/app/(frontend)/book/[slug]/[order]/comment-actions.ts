'use server'

import { getPayload } from 'payload'
import { revalidatePath } from 'next/cache'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { getTenantFromHeaders } from '@/lib/tenant'
import { errorMessage } from '@/lib/errorMessage'

/* Комментарии к главам книг. Логика зеркалит publication/actions.ts, но цель —
   глава (chapter), а revalidate — страница ридера. */

const COMMENT_COOLDOWN_SEC = 30
const COMMENT_MAX_LEN = 2000

export type ActionResult = { ok: true } | { ok: false; error: string }

function toNum(v: string | number | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

async function ctx() {
  const payload = await getPayload({ config: await config })
  const tctx = await getTenantFromHeaders()
  const tenant = (tctx as any)?.tenant
  const subscriber = (await getCurrentSubscriber().catch(() => null)) as any
  return { payload, tenant, subscriber }
}

function revalidateReader(slug?: string | null, order?: string | number | null) {
  if (slug && order != null) revalidatePath(`/book/${slug}/${order}`)
}

export async function submitChapterComment(input: {
  chapterId: string | number
  text: string
  parentId?: string | number | null
  slug?: string | null
  order?: string | number | null
}): Promise<ActionResult> {
  const text = (input.text ?? '').trim()
  if (!text) return { ok: false, error: 'Комментарий пустой.' }
  if (text.length > COMMENT_MAX_LEN) return { ok: false, error: `Слишком длинно (максимум ${COMMENT_MAX_LEN}).` }

  const { payload, tenant, subscriber } = await ctx()
  if (!tenant?.id) return { ok: false, error: 'Тенант не определён.' }
  if (!subscriber?.id) return { ok: false, error: 'Войдите, чтобы комментировать.' }
  if (subscriber.isBlocked) return { ok: false, error: 'Действие недоступно.' }

  const chId = toNum(input.chapterId)
  if (!chId) return { ok: false, error: 'Некорректная глава.' }

  try {
    // Глава принадлежит тенанту?
    const ch = (await payload.findByID({ collection: 'chapters' as any, id: chId, depth: 0, overrideAccess: true }).catch(() => null)) as any
    const chTenant = ch && (typeof ch.tenant === 'object' ? ch.tenant?.id : ch.tenant)
    if (!ch || Number(chTenant) !== Number(tenant.id)) return { ok: false, error: 'Глава не найдена.' }

    // Антиспам-кулдаун.
    const last = await payload.find({
      collection: 'comments',
      where: { and: [{ author: { equals: subscriber.id } }, { tenant: { equals: tenant.id } }] },
      sort: '-createdAt', depth: 0, limit: 1, overrideAccess: true,
    })
    const lastDoc = (last as any)?.docs?.[0]
    if (lastDoc?.createdAt) {
      const elapsed = (Date.now() - new Date(lastDoc.createdAt).getTime()) / 1000
      if (elapsed < COMMENT_COOLDOWN_SEC) return { ok: false, error: `Подождите ${Math.ceil(COMMENT_COOLDOWN_SEC - elapsed)} с.` }
    }

    await payload.create({
      collection: 'comments',
      data: { chapter: chId, author: toNum(subscriber.id)!, text, parent: toNum(input.parentId), status: 'published', tenant: toNum(tenant.id)! } as any,
      overrideAccess: true,
    })
    revalidateReader(input.slug, input.order)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error && /один уровень|корнев/i.test(e.message)
      ? 'Отвечать можно только на корневой комментарий.'
      : 'Не удалось отправить комментарий.'
    return { ok: false, error: msg }
  }
}

export async function hideChapterComment(input: {
  commentId: string | number
  slug?: string | null
  order?: string | number | null
}): Promise<ActionResult> {
  const { payload, tenant, subscriber } = await ctx()
  if (!tenant?.id) return { ok: false, error: 'Тенант не определён.' }
  if (!subscriber?.id) return { ok: false, error: 'Войдите.' }
  if (subscriber.isBlocked || (Number(subscriber.level) || 0) < 3) return { ok: false, error: 'Недостаточно прав.' }
  const cid = toNum(input.commentId)
  if (!cid) return { ok: false, error: 'Некорректный комментарий.' }
  try {
    const c = (await payload.findByID({ collection: 'comments', id: cid, depth: 0, overrideAccess: true }).catch(() => null)) as any
    const cTenant = c && (typeof c.tenant === 'object' ? c.tenant?.id : c.tenant)
    if (!c || Number(cTenant) !== Number(tenant.id)) return { ok: false, error: 'Комментарий не найден.' }
    await payload.update({ collection: 'comments', id: cid, data: { status: 'hidden' } as any, overrideAccess: true })
    revalidateReader(input.slug, input.order)
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, 'Не удалось скрыть.') }
  }
}
