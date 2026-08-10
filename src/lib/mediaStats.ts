import type { Payload } from 'payload'

/**
 * Статистика медиа тенанта для дашборда: сколько файлов загружено и сколько
 * места они фактически занимают на диске (включая сгенерированные превью).
 *
 * Считаем прямым SQL-агрегатом по коллекциям, чтобы не тянуть тысячи документов
 * в память ради суммы filesize. Коллекция `media` хранит и обложки, и аудио
 * (mime image/* и audio/*) — разделяем их по mime_type, аудио из media
 * складываем со студийными аудио-публикациями (videos.provider='audio') в одну
 * строку «Аудио»:
 *  - media (image/*) — обложки (+ варианты card/poster/thumb);
 *  - media (audio/*) + videos.audio — аудио (медиатека + студийные публикации);
 *  - gallery_images  — фото галерей (+ варианты thumbnail/large);
 *  - downloads       — произвольные файлы для скачивания (без вариантов);
 *  - videos.self     — своё видео (HLS+постер+сториборд), размер в asset_bytes.
 *
 * filesize в Payload/Postgres — numeric, поэтому SUM(...) приходит строкой;
 * приводим через Number. Ошибки БД не должны ронять дашборд — при сбое
 * возвращаем null, секцию просто не показываем.
 */

export interface MediaSourceStat {
  key: 'media' | 'gallery' | 'downloads' | 'video' | 'audio'
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
  media: 'Обложки',
  audio: 'Аудио',
  gallery: 'Галерея',
  downloads: 'Файлы для скачивания',
  video: 'Видео',
}

// Порядок строк в разбивке (обложки → аудио → галерея → файлы → видео).
const ORDER: MediaSourceStat['key'][] = ['media', 'audio', 'gallery', 'downloads', 'video']

export async function getMediaStats(payload: Payload, tenantId: number | string): Promise<MediaStats | null> {
  const pool = (payload.db as unknown as { pool?: { query: (text: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> } }).pool
  if (!pool || typeof pool.query !== 'function') return null

  // Каждая строка — (src, files, bytes). Аудио приходит двумя строками
  // ('audio' из media по mime и 'audio' из videos), суммируем их в JS.
  const sql = `
    SELECT 'media' AS src,
           COUNT(*) FILTER (WHERE COALESCE(mime_type, '') NOT LIKE 'audio/%')::int AS files,
           COALESCE(SUM(
             COALESCE(filesize, 0)
             + COALESCE(sizes_card_filesize, 0)
             + COALESCE(sizes_poster_filesize, 0)
             + COALESCE(sizes_thumb_filesize, 0)
           ) FILTER (WHERE COALESCE(mime_type, '') NOT LIKE 'audio/%'), 0)::bigint AS bytes
      FROM media WHERE tenant_id = $1
    UNION ALL
    SELECT 'audio',
           COUNT(*) FILTER (WHERE mime_type LIKE 'audio/%')::int,
           COALESCE(SUM(COALESCE(filesize, 0)) FILTER (WHERE mime_type LIKE 'audio/%'), 0)::bigint
      FROM media WHERE tenant_id = $1
    UNION ALL
    SELECT 'audio',
           COUNT(*) FILTER (WHERE provider = 'audio')::int,
           COALESCE(SUM(COALESCE(asset_bytes, 0)) FILTER (WHERE provider = 'audio'), 0)::bigint
      FROM videos WHERE tenant_id = $1
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
    // Складываем строки с одинаковым src (аудио приходит из двух таблиц).
    const acc = new Map<MediaSourceStat['key'], { files: number; bytes: number }>()
    for (const r of res.rows) {
      const key = String(r.src) as MediaSourceStat['key']
      const cur = acc.get(key) ?? { files: 0, bytes: 0 }
      cur.files += Number(r.files) || 0
      cur.bytes += Number(r.bytes) || 0
      acc.set(key, cur)
    }
    const sources: MediaSourceStat[] = ORDER.filter((k) => acc.has(k)).map((key) => {
      const v = acc.get(key)!
      return { key, label: LABELS[key] ?? key, files: v.files, bytes: v.bytes }
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
