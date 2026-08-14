import { withAuthor, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { isSuperAdmin } from '@/access'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { formatBytes } from '@/lib/mediaStats'

/**
 * Диагностика видео в бакете: группирует HLS по `hls/<playbackId>/…` и исходники
 * `originals/…`, затем сверяет с таблицей videos (playback_id). Показывает, какие
 * playback'и ЖИВЫЕ (есть запись видео) и какие ОСИРОТЕЛИ (записи нет — видео
 * удалили или это старая перекодировка). Осиротевшие безопасно чистить.
 *
 * Открой в браузере под супер-админом: /studio/api/storage-audit/videos
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export const GET = withAuthor(async ({ payload, author }) => {
  if (!isSuperAdmin(author.user as any)) return apiError('Доступно только супер-администратору', 403)

  const endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT
  const bucket = process.env.S3_BUCKET || process.env.R2_BUCKET
  const region = process.env.S3_REGION || process.env.R2_REGION || 'ru-1'
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return apiError('Нет S3-переменных окружения', 500)

  const s3 = new S3Client({ endpoint, region, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } })

  // 1) Скан бакета: агрегируем HLS по playbackId + исходники originals/
  const hls = new Map<string, { bytes: number; count: number }>()
  const originals: { key: string; bytes: number }[] = []
  let token: string | undefined
  let pages = 0
  const MAX_PAGES = 500
  try {
    do {
      const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token, MaxKeys: 1000 }))
      for (const o of r.Contents || []) {
        const k = o.Key || ''
        const sz = o.Size || 0
        const m = k.match(/^hls\/([^/]+)\//)
        if (m) {
          const cur = hls.get(m[1]) || { bytes: 0, count: 0 }
          cur.bytes += sz; cur.count += 1; hls.set(m[1], cur)
        } else if (k.startsWith('originals/')) {
          originals.push({ key: k, bytes: sz })
        }
      }
      token = r.IsTruncated ? r.NextContinuationToken : undefined
      pages++
    } while (token && pages < MAX_PAGES)
  } catch (e: any) {
    return apiError('S3: ' + (e?.message || 'ошибка листинга'), 502)
  }

  // 2) БД: playback_id → {title, asset_bytes, tenant_id}
  const pool = (payload.db as unknown as { pool?: { query: (t: string, p: unknown[]) => Promise<{ rows: any[] }> } }).pool
  const known = new Map<string, { title: string; assetBytes: number; tenantId: number }>()
  const activeOriginalKeys = new Set<string>()
  if (pool?.query) {
    try {
      const vids = await pool.query(`SELECT playback_id, title, asset_bytes, tenant_id FROM videos WHERE playback_id IS NOT NULL`, [])
      for (const v of vids.rows) known.set(String(v.playback_id), { title: v.title || 'Без названия', assetBytes: Number(v.asset_bytes) || 0, tenantId: Number(v.tenant_id) || 0 })
      // Исходники, ещё нужные незавершённым джобам (их удалять нельзя).
      const jobs = await pool.query(`SELECT original_key FROM video_jobs WHERE original_key IS NOT NULL AND status IN ('queued','processing')`, [])
      for (const j of jobs.rows) if (j.original_key) activeOriginalKeys.add(String(j.original_key))
    } catch (e: any) {
      return apiError('DB: ' + (e?.message || 'ошибка запроса'), 500)
    }
  }

  // 3) Сверка
  const live: any[] = []
  const orphanHls: any[] = []
  for (const [pid, agg] of hls) {
    const v = known.get(pid)
    if (v) live.push({ playbackId: pid, title: v.title, tenantId: v.tenantId, bucketBytes: agg.bytes, bucketHuman: formatBytes(agg.bytes), assetBytes: v.assetBytes, segments: agg.count })
    else orphanHls.push({ playbackId: pid, bytes: agg.bytes, human: formatBytes(agg.bytes), segments: agg.count })
  }
  live.sort((a, b) => b.bucketBytes - a.bucketBytes)
  orphanHls.sort((a, b) => b.bytes - a.bytes)

  const orphanSources = originals
    .filter((o) => !activeOriginalKeys.has(o.key))
    .sort((a, b) => b.bytes - a.bytes)
    .map((o) => ({ key: o.key, bytes: o.bytes, human: formatBytes(o.bytes) }))

  const orphanHlsBytes = orphanHls.reduce((s, x) => s + x.bytes, 0)
  const orphanSrcBytes = orphanSources.reduce((s, x) => s + x.bytes, 0)
  const liveBytes = live.reduce((s, x) => s + x.bucketBytes, 0)

  return apiOk({
    bucket,
    summary: {
      liveVideos: live.length,
      liveBytesHuman: formatBytes(liveBytes),
      orphanHlsTrees: orphanHls.length,
      orphanHlsHuman: formatBytes(orphanHlsBytes),
      orphanSources: orphanSources.length,
      orphanSourcesHuman: formatBytes(orphanSrcBytes),
      reclaimableHuman: formatBytes(orphanHlsBytes + orphanSrcBytes),
    },
    live,
    orphanHls,
    orphanSources,
  })
})
