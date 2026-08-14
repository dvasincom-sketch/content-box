import { withAuthor, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { isSuperAdmin } from '@/access'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { formatBytes } from '@/lib/mediaStats'

/**
 * Серверный аудит бакета S3 — что физически лежит и сколько весит. Работает с
 * ВНУТРЕННЕЙ стороны (у сервера доступ к S3 есть, в отличие от Mac за фаерволом
 * во время аварий). Открой в браузере под супер-админом:
 *   /studio/api/storage-audit
 * Возвращает JSON: всего объектов/объём, разбивка (оригиналы/превью/видео/аудио/
 * прочее), по тенант-префиксу `t<id>-`, топ расширений и топ-40 крупнейших.
 * Только супер-админ: показывает ВЕСЬ бакет (все тенанты).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const IMG = /\.(jpe?g|png|webp|gif|avif|svg)$/i
const VID = /\.(mp4|webm|mov|m3u8|ts|mkv)$/i
const AUD = /\.(mp3|m4a|ogg|wav|flac|aac|weba)$/i
const DERIV = /-\d+x\d+\.\w+$/i

export const GET = withAuthor(async ({ author }) => {
  if (!isSuperAdmin(author.user as any)) return apiError('Доступно только супер-администратору', 403)

  const endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT
  const bucket = process.env.S3_BUCKET || process.env.R2_BUCKET
  const region = process.env.S3_REGION || process.env.R2_REGION || 'ru-1'
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return apiError('Нет S3-переменных окружения', 500)

  const s3 = new S3Client({ endpoint, region, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } })

  let token: string | undefined
  let totalBytes = 0
  let totalCount = 0
  let pages = 0
  const cat: Record<string, { c: number; b: number }> = {
    originals: { c: 0, b: 0 }, derivatives: { c: 0, b: 0 }, video: { c: 0, b: 0 }, audio: { c: 0, b: 0 }, other: { c: 0, b: 0 },
  }
  const byTenant = new Map<string, { c: number; b: number }>()
  const byExt = new Map<string, { c: number; b: number }>()
  const largest: { key: string; size: number }[] = []
  const MAX_PAGES = 500

  try {
    do {
      const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token, MaxKeys: 1000 }))
      for (const o of r.Contents || []) {
        const k = o.Key || ''
        const sz = o.Size || 0
        totalCount++
        totalBytes += sz
        const ext = (k.split('.').pop() || '(none)').toLowerCase().slice(0, 8)
        const be = byExt.get(ext) || { c: 0, b: 0 }; be.c++; be.b += sz; byExt.set(ext, be)
        const m = k.match(/^t(\d+)-/)
        const tk = m ? `t${m[1]}` : '(без префикса / легаси)'
        const bt = byTenant.get(tk) || { c: 0, b: 0 }; bt.c++; bt.b += sz; byTenant.set(tk, bt)
        let key: keyof typeof cat = 'other'
        if (VID.test(k)) key = 'video'
        else if (AUD.test(k)) key = 'audio'
        else if (IMG.test(k)) key = DERIV.test(k) ? 'derivatives' : 'originals'
        cat[key].c++; cat[key].b += sz
        largest.push({ key: k, size: sz })
      }
      token = r.IsTruncated ? r.NextContinuationToken : undefined
      pages++
    } while (token && pages < MAX_PAGES)
  } catch (e: any) {
    return apiError('S3: ' + (e?.message || 'ошибка листинга бакета'), 502)
  }

  largest.sort((a, b) => b.size - a.size)
  const fmt = (b: number) => formatBytes(b)
  return apiOk({
    bucket,
    total: { count: totalCount, bytes: totalBytes, human: fmt(totalBytes) },
    truncated: pages >= MAX_PAGES,
    categories: Object.fromEntries(
      Object.entries(cat).filter(([, v]) => v.c).map(([k, v]) => [k, { count: v.c, bytes: v.b, human: fmt(v.b) }]),
    ),
    byTenant: Array.from(byTenant.entries()).sort((a, b) => b[1].b - a[1].b).map(([k, v]) => ({ tenant: k, count: v.c, bytes: v.b, human: fmt(v.b) })),
    byExt: Array.from(byExt.entries()).sort((a, b) => b[1].b - a[1].b).slice(0, 15).map(([k, v]) => ({ ext: k, count: v.c, bytes: v.b, human: fmt(v.b) })),
    largest: largest.slice(0, 40).map((o) => ({ key: o.key, bytes: o.size, human: fmt(o.size) })),
  })
})
