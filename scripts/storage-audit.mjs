/**
 * Аудит объектного хранилища (S3-бакета) — что физически лежит и сколько весит.
 * Работает НАПРЯМУЮ с S3 (БД не нужна), запускается откуда угодно, где доступен
 * S3-эндпоинт (в т.ч. с твоего Mac). Креды берутся из .env — я их не вижу.
 *
 * Запуск:
 *   node --env-file=.env scripts/storage-audit.mjs
 */
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

const endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT
const bucket = process.env.S3_BUCKET || process.env.R2_BUCKET
const region = process.env.S3_REGION || process.env.R2_REGION || 'ru-1'
const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  console.error('Нет S3-переменных в .env (S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY, либо R2_*).')
  process.exit(1)
}

const s3 = new S3Client({ endpoint, region, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } })

const fmt = (b) =>
  b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB'
  : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB'
  : (b / 1024).toFixed(0) + ' KB'

const IMG = /\.(jpe?g|png|webp|gif|avif|svg)$/i
const VID = /\.(mp4|webm|mov|m3u8|ts|mkv)$/i
const AUD = /\.(mp3|m4a|ogg|wav|flac|aac)$/i
const DERIV = /-\d+x\d+\.\w+$/i

let token
let totalBytes = 0
let totalCount = 0
const cat = {
  'kартинки-оригиналы': { c: 0, b: 0 },
  'превью (варианты)': { c: 0, b: 0 },
  'видео': { c: 0, b: 0 },
  'аудио': { c: 0, b: 0 },
  'прочее': { c: 0, b: 0 },
}
const byExt = {}
const largest = []

console.log('Сканирую бакет ' + bucket + ' на ' + endpoint + ' …')
do {
  const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token, MaxKeys: 1000 }))
  for (const o of r.Contents || []) {
    const k = o.Key || ''
    const sz = o.Size || 0
    totalBytes += sz
    totalCount++
    const ext = (k.split('.').pop() || '(нет)').toLowerCase().slice(0, 8)
    byExt[ext] = byExt[ext] || { c: 0, b: 0 }
    byExt[ext].c++
    byExt[ext].b += sz
    let key = 'прочее'
    if (VID.test(k)) key = 'видео'
    else if (AUD.test(k)) key = 'аудио'
    else if (IMG.test(k)) key = DERIV.test(k) ? 'превью (варианты)' : 'kартинки-оригиналы'
    cat[key].c++
    cat[key].b += sz
    largest.push({ k, sz })
  }
  token = r.IsTruncated ? r.NextContinuationToken : undefined
} while (token)

largest.sort((a, b) => b.sz - a.sz)

console.log('\n══════════════════════════════════════════')
console.log('ВСЕГО В БАКЕТЕ: ' + totalCount + ' объектов, ' + fmt(totalBytes))
console.log('══════════════════════════════════════════\n')

console.log('По категориям:')
for (const [k, v] of Object.entries(cat)) if (v.c) console.log('  ' + k.padEnd(22) + String(v.c).padStart(6) + ' шт ' + fmt(v.b).padStart(10))

console.log('\nПо расширениям (топ-15 по объёму):')
Object.entries(byExt).sort((a, b) => b[1].b - a[1].b).slice(0, 15)
  .forEach(([e, v]) => console.log('  .' + e.padEnd(8) + String(v.c).padStart(6) + ' шт ' + fmt(v.b).padStart(10)))

console.log('\nТоп-40 крупнейших объектов:')
largest.slice(0, 40).forEach((o) => console.log('  ' + fmt(o.sz).padStart(10) + '  ' + o.k))
