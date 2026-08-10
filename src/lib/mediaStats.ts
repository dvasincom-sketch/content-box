import type { Payload } from 'payload'

/**
 * Статистика медиа тенанта для дашборда: сколько файлов загружено и сколько
 * места они фактически занимают на диске (включая сгенерированные превью).
 *
 * Считаем прямым SQL-агрегатом по трём upload-коллекциям, чтобы не тянуть
 * тысячи документов в память ради суммы filesize:
 *  - media          — обложки/аудио (+ варианты card/poster/thumb);
 *  - gallery_images — фото галерей (+ варианты thumbnail/large);
 *  - downloads      — произвольные файлы для скачивания (без вариантов).
 *
 * filesize в Payload/Postgres — numeric, поэтому SUM(...) приходит строкой;
 * приводим через Number. Ошибки БД не должны ронять дашборд — при сбое
 * возвращаем null, секцию просто не показываем.
 */

export interface MediaSourceStat {
  key: 'media' | 'gallery' | 'downloads' | 'video'
  label: string
  files: number
  bytes: number
}

export interface MediaStats {
  files: number
  bytes: number
  sources: MediaSourceStat[]
}

const LABELS: Record<MediaSourceStat['key'], string> = {
  media: 'Обложки и аудио',
  gallery: 'Галерея',
  downloads: 'Файлы для скачивания',
  video: 'Видео',
}

export async function getMediaStats(payload: Payload, tenantId: number | string): Promise<MediaStats | null> {
  const pool = (payload.db as unknown as { pool?: { query: (text: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> } }).pool
  if (!pool || typeof pool.query !== 'function') return null

  const sql = `
    SELECT 'media' AS src,
           COUNT(*)::int AS files,
           COALESCE(SUM(
             COALESCE(filesize, 0)
             + COALESCE(sizes_card_filesize, 0)
             + COALESCE(sizes_poster_filesize, 0)
             + COALESCE(sizes_thumb_filesize, 0)
           ), 0)::bigint AS bytes
      FROM media WHERE tenant_id = $1
    UNION ALL
    SELECT 'gallery',
           COUNT(*)::int,
           COALESCE(SUM(
             COALESCE(filesize, 0)
             + COALESCE(sizes_thumbnail_filesize, 0)
             + COALESCE(sizes_large_filesize, 0)
           ), 0)::bigint
      FROM gallery_images WHERE tenant_id = $1
    UNION ALL
    SELECT 'downloads',
           COUNT(*)::int,
           COALESCE(SUM(COALESCE(filesize, 0)), 0)::bigint
      FROM downloads WHERE tenant_id = $1
    UNION ALL
    SELECT 'video',
           COUNT(*) FILTER (WHERE provider = 'self')::int,
           COALESCE(SUM(COALESCE(asset_bytes, 0)) FILTER (WHERE provider = 'self'), 0)::bigint
      FROM videos WHERE tenant_id = $1
  `

  try {
    const res = await pool.query(sql, [tenantId])
    const sources: MediaSourceStat[] = res.rows.map((r) => {
      const key = String(r.src) as MediaSourceStat['key']
      return {
        key,
        label: LABELS[key] ?? key,
        files: Number(r.files) || 0,
        bytes: Number(r.bytes) || 0,
      }
    })
    const files = sources.reduce((s, x) => s + x.files, 0)
    const bytes = sources.reduce((s, x) => s + x.bytes, 0)
    return { files, bytes, sources }
  } catch {
    return null
  }
}

/** Человекочитаемый размер: 0 B / 12 KB / 3.4 MB / 1.2 GB. */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  const rounded = v >= 100 || i === 0 ? Math.round(v) : Math.round(v * 10) / 10
  return `${rounded} ${units[i]}`
}
