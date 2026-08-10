/**
 * Бэкофилл asset_bytes для видео/аудио, залитых до появления учёта размера.
 *
 * Считает реальный вес объектов в S3 и пишет его в videos.asset_bytes:
 *  - provider='self'  → сумма по префиксам hls/{pb}/, sprites/{pb}/,
 *                        posters/{pb}, preview/{pb};
 *  - provider='audio' → размер одного объекта (ключ из audio_src).
 *
 * По умолчанию трогает только строки с asset_bytes IS NULL. Флаг --all —
 * пересчитать все (self+audio). Флаг --dry — только показать, ничего не писать.
 *
 * Запуск (в вашем терминале, где виден и DATABASE_URL, и S3):
 *   node scripts/backfill-video-bytes.mjs
 *   node scripts/backfill-video-bytes.mjs --dry
 *   node scripts/backfill-video-bytes.mjs --all
 */
import 'dotenv/config'
import pg from 'pg'
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3'

const DRY = process.argv.includes('--dry')
const ALL = process.argv.includes('--all')

const BUCKET = process.env.S3_BUCKET || process.env.R2_BUCKET || ''
const PUBLIC_BASE = (process.env.S3_PUBLIC_URL || process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '')
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || process.env.R2_ENDPOINT || '',
  region: process.env.S3_REGION || 'ru-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '',
  },
})

if (!BUCKET) { console.error('Нет S3_BUCKET/R2_BUCKET в окружении'); process.exit(1) }

/** Сумма размеров всех объектов под префиксом (постранично). */
async function sumPrefix(prefix) {
  let total = 0, count = 0, token
  do {
    const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken: token }))
    for (const o of r.Contents || []) { total += Number(o.Size || 0); count++ }
    token = r.IsTruncated ? r.NextContinuationToken : undefined
  } while (token)
  return { total, count }
}

async function headSize(key) {
  try { const r = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })); return Number(r.ContentLength || 0) }
  catch { return 0 }
}

function keyFromPublicUrl(url) {
  if (!url || !PUBLIC_BASE) return null
  const base = PUBLIC_BASE + '/'
  return url.startsWith(base) ? url.slice(base.length) : null
}

const fmt = (n) => {
  if (!n) return '0 B'
  const u = ['B','KB','MB','GB','TB']; let i = 0, v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${Math.round(v * 10) / 10} ${u[i]}`
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()

const cond = ALL ? '' : 'AND asset_bytes IS NULL'
const self = await c.query(`SELECT id, tenant_id, playback_id, title FROM videos WHERE provider='self' ${cond} ORDER BY id`)
const audio = await c.query(`SELECT id, tenant_id, audio_src, title FROM videos WHERE provider='audio' ${cond} ORDER BY id`)

console.log(`\n=== SELF: ${self.rows.length} видео ${ALL ? '(все)' : '(только NULL)'} ===`)
let updated = 0
for (const v of self.rows) {
  const pb = v.playback_id
  if (!pb) { console.log(`  #${v.id} — нет playback_id, пропуск`); continue }
  let bytes = 0, files = 0
  for (const p of [`hls/${pb}/`, `sprites/${pb}/`, `posters/${pb}`, `preview/${pb}`]) {
    const { total, count } = await sumPrefix(p)
    bytes += total; files += count
  }
  console.log(`  #${v.id} t${v.tenant_id} [${pb}] → ${fmt(bytes)} (${files} обj.)  ${v.title || ''}`)
  if (!DRY && bytes > 0) { await c.query('UPDATE videos SET asset_bytes=$1 WHERE id=$2', [bytes, v.id]); updated++ }
}

console.log(`\n=== AUDIO: ${audio.rows.length} аудио ${ALL ? '(все)' : '(только NULL)'} ===`)
for (const v of audio.rows) {
  const key = keyFromPublicUrl(v.audio_src)
  if (!key) { console.log(`  #${v.id} — не разобрать ключ из ${v.audio_src}, пропуск`); continue }
  const bytes = await headSize(key)
  console.log(`  #${v.id} t${v.tenant_id} [${key}] → ${fmt(bytes)}  ${v.title || ''}`)
  if (!DRY && bytes > 0) { await c.query('UPDATE videos SET asset_bytes=$1 WHERE id=$2', [bytes, v.id]); updated++ }
}

console.log(`\n${DRY ? 'DRY — ничего не записано.' : `Обновлено строк: ${updated}.`}`)
await c.end()
