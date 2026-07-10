/**
 * Полный путь категории из её breadcrumbs (последняя крошка).
 * '/videography/concerts' → ссылка '/category/videography/concerts'
 * Фолбэк на slug, если крошек нет (корневая без плагина или depth: 0).
 */
export function categoryHref(category: {
  slug?: string | null
  breadcrumbs?: { url?: string | null }[] | null
}): string {
  const crumbs = category?.breadcrumbs
  if (Array.isArray(crumbs) && crumbs.length > 0) {
    const last = crumbs[crumbs.length - 1]?.url
    if (last) return `/category${last}`
  }
  return category?.slug ? `/category/${category.slug}` : '/'
}
