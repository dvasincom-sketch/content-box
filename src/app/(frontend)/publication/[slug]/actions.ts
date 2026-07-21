'use server'

import { getPayload } from 'payload'
import { revalidatePath } from 'next/cache'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { getTenantFromHeaders } from '@/lib/tenant'

/* ============================================================================
   Server Actions — запись реакций и комментариев от посетителей.
   Все мутации идут под аутентифицированным подписчиком (getCurrentSubscriber).
   Гость получает отказ. Заблокированный (isBlocked) — отказ. tenant берём из
   заголовков, не доверяя клиенту. Валидация + лёгкий rate-limit по timestamp.
   ============================================================================ */

const REACTION_KEYS = ['like', 'love', 'fire', 'cry'] as const
type ReactionKey = (typeof REACTION_KEYS)[number]

// Минимальный интервал между комментариями одного подписчика (антиспам).
const COMMENT_COOLDOWN_SEC = 30
const COMMENT_MAX_LEN = 2000

export type ActionResult = { ok: true } | { ok: false; error: string }

// id в схеме — number (Postgres serial). Клиент может прислать строкой — нормализуем.
function toNum(v: string | number | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

async function ctx() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const tctx = await getTenantFromHeaders()
  const tenant = (tctx as any)?.tenant
  const subscriber = (await getCurrentSubscriber().catch(() => null)) as any
  return { payload, tenant, subscriber }
}

/** revalidate страницы публикации по slug (для комментов — правдивое обновление). */
function revalidatePublication(slug?: string | null) {
  if (slug) revalidatePath(`/publication/${slug}`)
}

/* ── Поставить/снять/сменить реакцию ────────────────────────────────────────
   targetType: 'publication' | 'comment'. Уникальность (один подписчик = одна
   реакция на объект) держит хук beforeChange коллекции; здесь добавляем
   идемпотентность: повторная та же эмодзи = снять (toggle). */
export async function toggleReaction(input: {
  targetType: 'publication' | 'comment'
  targetId: string | number
  emoji: ReactionKey
  publicationSlug?: string | null
}): Promise<ActionResult> {
  if (!REACTION_KEYS.includes(input.emoji)) return { ok: false, error: 'Неизвестная реакция.' }

  const { payload, tenant, subscriber } = await ctx()
  if (!tenant?.id) return { ok: false, error: 'Тенант не определён.' }
  if (!subscriber?.id) return { ok: false, error: 'Войдите, чтобы реагировать.' }
  if (subscriber.isBlocked) return { ok: false, error: 'Действие недоступно.' }

  const targetField = input.targetType === 'comment' ? 'comment' : 'publication'

  try {
    // есть ли уже реакция этого подписчика на этот объект?
    const existing = await payload.find({
      collection: 'reactions',
      where: {
        and: [
          { subscriber: { equals: subscriber.id } },
          { [targetField]: { equals: input.targetId } },
          { tenant: { equals: tenant.id } },
        ],
      },
      depth: 0,
      limit: 10,
      overrideAccess: true,
    })
    const docs = (existing as any)?.docs ?? []

    // Та же эмодзи стоит → снять (toggle off).
    const same = docs.find((d: any) => d.emoji === input.emoji)
    if (same) {
      await payload.delete({ collection: 'reactions', id: same.id, overrideAccess: true })
      revalidatePublication(input.publicationSlug)
      return { ok: true }
    }

    // Иначе создаём новую (хук beforeChange уберёт прежние эмодзи этого юзера).
    await payload.create({
      collection: 'reactions',
      data: {
        targetType: input.targetType,
        [targetField]: toNum(input.targetId)!,
        subscriber: toNum(subscriber.id)!,
        emoji: input.emoji,
        tenant: toNum(tenant.id)!,
      },
      overrideAccess: true,
    })
    revalidatePublication(input.publicationSlug)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Не удалось сохранить реакцию.' }
  }
}

/* ── Отправить комментарий или ответ ────────────────────────────────────────
   parentId задан → ответ (один уровень; хук коллекции не даст ответить на ответ). */
export async function submitComment(input: {
  publicationId: string | number
  text: string
  parentId?: string | number | null
  publicationSlug?: string | null
}): Promise<ActionResult> {
  const text = (input.text ?? '').trim()
  if (!text) return { ok: false, error: 'Комментарий пустой.' }
  if (text.length > COMMENT_MAX_LEN)
    return { ok: false, error: `Слишком длинно (максимум ${COMMENT_MAX_LEN}).` }

  const { payload, tenant, subscriber } = await ctx()
  if (!tenant?.id) return { ok: false, error: 'Тенант не определён.' }
  if (!subscriber?.id) return { ok: false, error: 'Войдите, чтобы комментировать.' }
  if (subscriber.isBlocked) return { ok: false, error: 'Действие недоступно.' }

  try {
    // Rate-limit: когда этот подписчик комментировал в последний раз?
    const last = await payload.find({
      collection: 'comments',
      where: {
        and: [
          { author: { equals: subscriber.id } },
          { tenant: { equals: tenant.id } },
        ],
      },
      sort: '-createdAt',
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const lastDoc = (last as any)?.docs?.[0]
    if (lastDoc?.createdAt) {
      const elapsedSec = (Date.now() - new Date(lastDoc.createdAt).getTime()) / 1000
      if (elapsedSec < COMMENT_COOLDOWN_SEC) {
        const wait = Math.ceil(COMMENT_COOLDOWN_SEC - elapsedSec)
        return { ok: false, error: `Подождите ${wait} с перед следующим комментарием.` }
      }
    }

    await payload.create({
      collection: 'comments',
      data: {
        publication: toNum(input.publicationId)!,
        author: toNum(subscriber.id)!,
        text,
        parent: toNum(input.parentId),
        status: 'published',
        tenant: toNum(tenant.id)!,
      },
      overrideAccess: true,
    })
    revalidatePublication(input.publicationSlug)
    return { ok: true }
  } catch (e) {
    // Хук ветвления (ответ на ответ) кидает ошибку — показываем понятный текст.
    const msg = e instanceof Error && /один уровень|корнев/i.test(e.message)
      ? 'Отвечать можно только на корневой комментарий.'
      : 'Не удалось отправить комментарий.'
    return { ok: false, error: msg }
  }
}
