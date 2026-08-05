'use server'

import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { getTenantFromHeaders } from '@/lib/tenant'
import { errorMessage } from '@/lib/errorMessage'

/* Соцфункции (Фаза 5): закладки, подписки на аккаунты, история просмотров.
   Все мутации — под текущим подписчиком, tenant из заголовков. */

async function ctx() {
  const payload = await getPayload({ config: await config })
  const tctx = await getTenantFromHeaders()
  const tenantId = (tctx as any)?.tenant?.id ?? null
  const subscriber = (await getCurrentSubscriber().catch(() => null)) as any
  return { payload, tenantId, subscriber }
}

export async function toggleBookmark(input: { targetType: 'publication' | 'video' | 'book'; targetId: string | number }): Promise<{ ok: boolean; saved?: boolean; error?: string }> {
  const { payload, tenantId, subscriber } = await ctx()
  if (!tenantId) return { ok: false, error: 'Тенант не определён.' }
  if (!subscriber?.id) return { ok: false, error: 'Войдите, чтобы сохранять.' }
  const field = input.targetType // 'publication' | 'video' | 'book' — совпадает с именем колонки
  const tid = Number(input.targetId)
  if (!tid) return { ok: false, error: 'Некорректный объект.' }
  try {
    const existing = await payload.find({
      collection: 'bookmarks',
      where: { and: [{ subscriber: { equals: subscriber.id } }, { tenant: { equals: tenantId } }, { [field]: { equals: tid } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      await payload.delete({ collection: 'bookmarks', id: (existing.docs[0] as any).id, overrideAccess: true })
      return { ok: true, saved: false }
    }
    await payload.create({ collection: 'bookmarks', data: { tenant: tenantId, subscriber: subscriber.id, targetType: input.targetType, [field]: tid } as any, overrideAccess: true })
    return { ok: true, saved: true }
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, 'Ошибка') }
  }
}

export async function toggleFollow(input: { handle?: string; targetId?: string | number }): Promise<{ ok: boolean; following?: boolean; error?: string }> {
  const { payload, tenantId, subscriber } = await ctx()
  if (!tenantId) return { ok: false, error: 'Тенант не определён.' }
  if (!subscriber?.id) return { ok: false, error: 'Войдите, чтобы подписаться.' }
  let targetId = input.targetId ? Number(input.targetId) : null
  if (!targetId && input.handle) {
    const t = await payload.find({ collection: 'subscribers', where: { and: [{ tenant: { equals: tenantId } }, { handle: { equals: input.handle } }] }, limit: 1, depth: 0, overrideAccess: true })
    targetId = (t.docs[0] as any)?.id ?? null
  }
  if (!targetId) return { ok: false, error: 'Профиль не найден.' }
  if (Number(targetId) === Number(subscriber.id)) return { ok: false, error: 'Нельзя подписаться на себя.' }
  try {
    const existing = await payload.find({
      collection: 'follows',
      where: { and: [{ follower: { equals: subscriber.id } }, { following: { equals: targetId } }, { tenant: { equals: tenantId } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      await payload.delete({ collection: 'follows', id: (existing.docs[0] as any).id, overrideAccess: true })
      return { ok: true, following: false }
    }
    await payload.create({ collection: 'follows', data: { tenant: tenantId, follower: subscriber.id, following: targetId } as any, overrideAccess: true })
    return { ok: true, following: true }
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, 'Ошибка') }
  }
}

export async function recordView(input: { targetType: 'publication' | 'video' | 'book'; targetId: string | number; chapterId?: string | number }): Promise<{ ok: boolean }> {
  const { payload, tenantId, subscriber } = await ctx()
  if (!tenantId || !subscriber?.id || subscriber.historyEnabled === false) return { ok: false }
  const field = input.targetType // совпадает с именем колонки
  const chapterId = input.chapterId != null ? Number(input.chapterId) || null : null
  const tid = Number(input.targetId)
  if (!tid) return { ok: false }
  const now = new Date().toISOString()
  try {
    const existing = await payload.find({
      collection: 'views',
      where: { and: [{ subscriber: { equals: subscriber.id } }, { tenant: { equals: tenantId } }, { [field]: { equals: tid } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      await payload.update({ collection: 'views', id: (existing.docs[0] as any).id, data: { viewedAt: now, ...(input.targetType === 'book' ? { chapter: chapterId } : {}) } as any, overrideAccess: true })
    } else {
      await payload.create({ collection: 'views', data: { tenant: tenantId, subscriber: subscriber.id, targetType: input.targetType, [field]: tid, viewedAt: now, ...(input.targetType === 'book' ? { chapter: chapterId } : {}) } as any, overrideAccess: true })
    }
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function clearHistory(): Promise<{ ok: boolean; error?: string }> {
  const { payload, tenantId, subscriber } = await ctx()
  if (!tenantId || !subscriber?.id) return { ok: false, error: 'Недоступно.' }
  try {
    await payload.delete({ collection: 'views', where: { and: [{ subscriber: { equals: subscriber.id } }, { tenant: { equals: tenantId } }] }, overrideAccess: true })
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, 'Ошибка') }
  }
}

export async function setHistoryEnabled(enabled: boolean): Promise<{ ok: boolean }> {
  const { payload, subscriber } = await ctx()
  if (!subscriber?.id) return { ok: false }
  try {
    await payload.update({ collection: 'subscribers', id: subscriber.id, data: { historyEnabled: !!enabled } as any, overrideAccess: true })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
