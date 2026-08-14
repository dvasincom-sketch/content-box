import { withAuthor, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { isSuperAdmin } from '@/access'
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { formatBytes } from '@/lib/mediaStats'

/**
 * Чистка ОСИРОТЕВШИХ исходников видео (`originals/…`) — оригиналы, оставшиеся
 * после транскода (штатно воркер их удаляет, но при сбое они висят). НЕ трогает
 * исходники, нужные незавершённым джобам (queued/processing).
 *
 *   GET  /studio/api/storage-audit/cleanup  → dry-run: что удалит и сколько вернёт
 *   POST /studio/api/storage-audit/cleanup  → реально удаляет
 *
 * Только супер-админ. HLS-деревья живых видео НЕ трогаем (это оплаченный контент).
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

async function findOrphanSources(payload: any) {
  const c = s3client()
  if (!c) throw new Error('Нет S3-переменных окружения')
  const { s3, bucket } = c
  // Исходники, нужные незавершённым джобам — не трогаем.
  const active = new Set<string>()
  const pool = (payload.db as any).pool
  if (pool?.query) {
    const jobs = await pool.query(`SELECT original_key FROM video_jobs WHERE original_key IS NOT NULL AND status IN ('queued','processing')`, [])
    for (const j of jobs.rows) if (j.original_key) active.add(String(j.original_key))
  }
  const orphans: { key: string; bytes: number }[] = []
  let token: string | undefined
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'originals/', ContinuationToken: token, MaxKeys: 1000 }))
    for (const o of r.Contents || []) {
      const k = o.Key || ''
      if (k && !active.has(k)) orphans.push({ key: k, bytes: o.Size || 0 })
    }
    token = r.IsTruncated ? r.NextContinuationToken : undefined
  } while (token)
  return { s3, bucket, orphans }
}

export const GET = withAuthor(async ({ payload, author }) => {
  if (!isSuperAdmin(author.user as any)) return apiError('Доступно только супер-администратору', 403)
  try {
    const { orphans } = await findOrphanSources(payload)
    const bytes = orphans.reduce((s, o) => s + o.bytes, 0)
    return apiOk({ dryRun: true, count: orphans.length, bytes, human: formatBytes(bytes), items: orphans.map((o) => ({ key: o.key, human: formatBytes(o.bytes) })) })
  } catch (e: any) {
    return apiError(e?.message || 'Ошибка', 502)
  }
})

export const POST = withAuthor(async ({ payload, author }) => {
  if (!isSuperAdmin(author.user as any)) return apiError('Доступно только супер-администратору', 403)
  try {
    const { s3, bucket, orphans } = await findOrphanSources(payload)
    if (!orphans.length) return apiOk({ deleted: 0, bytes: 0, human: '0 B' })
    // Удаляем пачками по 1000 (лимит DeleteObjects).
    for (let i = 0; i < orphans.length; i += 1000) {
      await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: orphans.slice(i, i + 1000).map((o) => ({ Key: o.key })) } }))
    }
    const bytes = orphans.reduce((s, o) => s + o.bytes, 0)
    return apiOk({ deleted: orphans.length, bytes, human: formatBytes(bytes) })
  } catch (e: any) {
    return apiError(e?.message || 'Ошибка удаления', 502)
  }
})
