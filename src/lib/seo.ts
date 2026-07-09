import type { Metadata } from 'next'

/** SEO-поля оверрайда (категория, публикация, страница). */
export type SeoOverride = {
  title?: string | null
  description?: string | null
  ogImage?: { url?: string | null } | string | number | null
} | null | undefined

/** SEO-дефолты тенанта (SiteSettings.seoDefaults). */
export type SeoDefaults = {
  titleTemplate?: string | null
  description?: string | null
  ogImage?: { url?: string | null } | string | number | null
} | null | undefined

function imageUrl(img: SeoOverride extends null ? never : any): string | undefined {
  if (!img) return undefined
  if (typeof img === 'object' && img.url) return img.url
  return undefined
}

/**
 * Каскад SEO-метатегов (ТЗ §6):
 *   дефолт тенанта → оверрайд категории → оверрайд публикации/страницы.
 * Более частный уровень перебивает более общий, поле за полем.
 *
 * @param defaults  SiteSettings.seoDefaults
 * @param levels    оверрайды от общего к частному (напр. [category.seo, publication.seo])
 * @param fallbackTitle  заголовок записи, если SEO-title не задан (напр. publication.title)
 * @param brandName      имя тенанта — для шаблона и og:site_name
 */
export function buildMetadata({
  defaults,
  levels = [],
  fallbackTitle,
  brandName,
}: {
  defaults?: SeoDefaults
  levels?: SeoOverride[]
  fallbackTitle?: string | null
  brandName?: string | null
}): Metadata {
  // Собираем: каждый следующий уровень перебивает предыдущий, если поле заполнено.
  let title: string | null | undefined
  let description: string | null | undefined
  let ogImg: string | undefined

  for (const level of levels) {
    if (!level) continue
    if (level.title) title = level.title
    if (level.description) description = level.description
    const url = imageUrl(level.ogImage)
    if (url) ogImg = url
  }

  // Фолбэки на уровень тенанта.
  if (!title) title = fallbackTitle || brandName || undefined
  if (!description) description = defaults?.description || undefined
  if (!ogImg) ogImg = imageUrl(defaults?.ogImage)

  // titleTemplate: "%s — COCO JAMBO"
  const template = defaults?.titleTemplate
  const finalTitle =
    template && title && template.includes('%s') ? template.replace('%s', title) : title

  const metadata: Metadata = {
    title: finalTitle,
    description: description ?? undefined,
    openGraph: {
      title: finalTitle ?? undefined,
      description: description ?? undefined,
      siteName: brandName ?? undefined,
      type: 'website',
      images: ogImg ? [{ url: ogImg }] : undefined,
    },
    twitter: {
      card: ogImg ? 'summary_large_image' : 'summary',
      title: finalTitle ?? undefined,
      description: description ?? undefined,
      images: ogImg ? [ogImg] : undefined,
    },
  }

  return metadata
}
