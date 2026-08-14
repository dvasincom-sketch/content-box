import { withAuthor, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { isSuperAdmin } from '@/access'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { formatBytes } from '@/lib/mediaStats'

/**
 * Пересчёт `videos.asset_bytes` ПО ФАКТУ из S3 — чинит недоучёт (asset_bytes мог
 * остаться от старого прогона транскода). Для каждого self-видео суммирует
 * hls/<playbackId>/ + постер + спрайты + превью и записывает в БД.
 *
 *   GET  → dry-run: что и на сколько изменится
 *   POST → записывает
 * Только супер-админ.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

function s3client() {
  const endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT
  const bucket = process.env.S3_BUCKET || process.env.R2_BUCKET
  const region = process.env.S3_REGION || process.env.R2_REGION || 'ru-1'
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null
  return { s3: new S3Client({ endpoint, region, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } }), bucket }
}

async function sumPrefix(s3: any, bucket: string, prefix: string): Promise<number> {
  let total = 0
  let token: string | undefined
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 }))
    for (const o of r.Contents || []) total += o.Size || 0
    token = r.IsTruncated ? r.NextContinuationToken : undefined
  } while (token)
  return total
}

async function computeAll(payload: any) {
  const c = s3client()
  if (!c) throw new Error('Нет S3-переменных окружения')
  const { s3, bucket } = c
  const pool = (payload.db as any).pool
  if (!pool?.query) throw new Error('Нет доступа к БД')
  const vids = await pool.query(`SELECT id, playback_id, title, asset_bytes FROM videos WHERE provider = 'self' AND playback_id IS NOT NULL`, [])
  const rows: any[] = []
  for (const v of vids.rows) {
    const pid = String(v.playback_id)
    const real = (await sumPrefix(s3, bucket, `hls/${pid}/`))
      + (await sumPrefix(s3, bucket, `sprites/${pid}/`))
      + (await sumPrefix(s3, bucket, `posters/${pid}.jpg`))
      + (await sumPrefix(s3, bucket, `preview/${pid}.gif`))
    rows.push({ id: v.id, title: v.title || '—', was: Number(v.asset_bytes) || 0, now: real })
  }
  return { pool, rows }
}

export const GET = withAuthor(async ({ payload, author }) => {
  if (!isSuperAdmin(author.user as any)) return apiError('Доступно только супер-администратору', 403)
  try {
    const { rows } = await computeAll(payload)
    return apiOk({ dryRun: true, videos: rows.map((r) => ({ title: r.title, wasHuman: formatBytes(r.was), nowHuman: formatBytes(r.now), changed: r.was !== r.now })) })
  } catch (e: any) {
    return apiError(e?.message || 'Ошибка', 502)
  }
})

export const POST = withAuthor(async ({ payload, author }) => {
  if (!isSuperAdmin(author.user as any)) return apiError('Доступно только супер-администратору', 403)
  try {
    const { pool, rows } = await computeAll(payload)
    let updated = 0
    for (const r of rows) {
      if (r.was !== r.now) { await pool.query(`UPDATE videos SET asset_bytes = $1 WHERE id = $2`, [r.now, r.id]); updated++ }
    }
    return apiOk({ updated, videos: rows.map((r) => ({ title: r.title, nowHuman: formatBytes(r.now) })) })
  } catch (e: any) {
    return apiError(e?.message || 'Ошибка записи', 502)
  }
})
