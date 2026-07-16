import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { Composer } from './Composer'

/**
 * Композер (Шаг 3). Серверная часть: подгружает категории и уровни подписки
 * тенанта автора (scoped), передаёт в клиентский Composer.
 *
 * Категории тянем с parent (nestedDocsPlugin) для построения дерева на клиенте.
 * limit поднят выше реального числа категорий (210+), чтобы ничего не срезалось.
 */

export const dynamic = 'force-dynamic'

export default async function NewPostPage() {
  const author = await getCurrentAuthor() // guard в (app)/layout гарантирует
  const payload = await getPayload({ config: await config })

  const [catsRes, tiersRes] = await Promise.all([
    payload.find({
      collection: 'categories',
      where: { tenant: { equals: author!.tenantId } },
      sort: 'title',
      limit: 1000,
      depth: 0, // parent придёт как id при depth:0 — этого достаточно для дерева
      overrideAccess: true,
    }),
    payload.find({
      collection: 'subscription-tiers',
      where: {
        and: [
          { tenant: { equals: author!.tenantId } },
          { isActive: { equals: true } },
        ],
      },
      sort: 'weight',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const categories = (catsRes.docs as any[]).map((c) => {
    // parent при depth:0 — это id (или объект, если плагин populate'ит). Нормализуем.
    const rawParent = c.parent
    const parentId =
      rawParent && typeof rawParent === 'object' ? rawParent.id : (rawParent ?? null)
    return {
      id: c.id,
      title: c.title || c.name || 'Без названия',
      parentId: parentId ?? null,
    }
  })

  const tiers = (tiersRes.docs as any[]).map((t) => ({
    id: t.id,
    name: t.name,
    weight: t.weight,
    priceRub: t.priceRub,
  }))

  return <Composer categories={categories} tiers={tiers} />
}
