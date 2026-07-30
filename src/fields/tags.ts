import type { Field } from 'payload'
import { slugify } from '../lib/slugify'

/**
 * Свободные теги для публикаций и видео. Автор просто вписывает текст —
 * slug считается автоматически (slugify), чтобы страницы /tag/<slug> работали
 * и «BTS» / «bts» / «Bts» вели на одну страницу.
 *
 * Хранится как array {label, slug}; slug readonly (заполняет normalizeTags в
 * хуке beforeChange коллекции). Запрос по тегу: where 'tags.slug' equals <slug>.
 */
export const tagsField: Field = {
  name: 'tags',
  type: 'array',
  label: 'Теги',
  labels: { singular: 'Тег', plural: 'Теги' },
  admin: {
    description: 'Свободные теги — связывают материалы из разных категорий. Slug считается автоматически.',
    initCollapsed: true,
  },
  fields: [
    { name: 'label', type: 'text', required: true, label: 'Тег' },
    {
      name: 'slug',
      type: 'text',
      index: true,
      label: 'Slug',
      admin: { readOnly: true, description: 'Автоматически из тега.' },
    },
  ],
}

/**
 * Нормализует data.tags: чистит пустые, тримит label, считает slug, убирает
 * дубли по slug. Вызывать в beforeChange коллекции. Мутирует и возвращает data.
 */
export function normalizeTags<T extends { tags?: unknown }>(data: T | undefined): T | undefined {
  if (!data || !Array.isArray((data as any).tags)) return data
  const seen = new Set<string>()
  const out: { label: string; slug: string }[] = []
  for (const row of (data as any).tags as any[]) {
    const label = typeof row?.label === 'string' ? row.label.trim() : ''
    if (!label) continue
    const slug = slugify(label)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    out.push({ label, slug })
  }
  ;(data as any).tags = out
  return data
}
