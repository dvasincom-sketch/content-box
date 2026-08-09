import { publicUrl } from './s3'

/**
 * URL обложки для карточки видео. Приоритет: загруженная обложка (её размеры),
 * затем — для своего видео (provider='self') автопостер из S3. Бакет публичный
 * (как media), поэтому постер отдаётся прямым publicUrl без подписи.
 */
export function videoThumbUrl(v: unknown): string | null {
  const o = (v || {}) as {
    cover?: { url?: string | null; sizes?: { thumb?: { url?: string | null }; card?: { url?: string | null } } } | null
    provider?: string | null
    posterKey?: string | null
  }
  const cover = o.cover && typeof o.cover === 'object' ? o.cover : null
  const fromCover = cover?.sizes?.thumb?.url || cover?.sizes?.card?.url || cover?.url || null
  if (fromCover) return fromCover
  if (o.provider === 'self' && o.posterKey) return publicUrl(String(o.posterKey))
  return null
}
