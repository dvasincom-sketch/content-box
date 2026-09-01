/**
 * Снимок предыдущей версии публикации (страховка от случайного сохранения).
 * Вынесено из route-файла: в Next 16 из route.ts нельзя экспортировать ничего,
 * кроме HTTP-хендлеров и конфигурации — посторонний экспорт валит type-check.
 * Используется в update-post и restore-post.
 */
export const SNAP_FIELDS = ['title', 'description', 'profile', 'template', 'cover', 'category', 'extraCategories', 'minTier', 'relatedVideos', 'gallery', 'tags', 'isNews', 'isNew', 'eventDate', 'publishedAt'] as const

export function snapshotOf(doc: any): Record<string, unknown> {
  const s: Record<string, unknown> = { savedAt: new Date().toISOString() }
  for (const key of SNAP_FIELDS) if (doc[key] !== undefined) s[key] = doc[key]
  return s
}
