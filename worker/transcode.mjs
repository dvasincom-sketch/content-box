// Транскод-воркер (Фаза 1, VOD). Отдельный сервис в docker-compose, тот же образ,
// что и app (в нём есть node_modules и ffmpeg). Поллит очередь video_jobs,
// гонит оригинал через FFmpeg в HLS ABR (1080/720/480) + постер/gif/сториборд,
// заливает артефакты в S3 и шлёт подписанный webhook video.asset.ready в app.
//
// Соединения к БД держим МИНИМУМ (managed-Postgres общий с app): pool max=2.
// Конкурентность транскода = 1 (одна тяжёлая ffmpeg-задача за раз), чтобы не
// душить веб на общей машине; процесс ffmpeg запускаем с nice.

import { spawn } from 'node:child_process'
import { createWriteStream, createReadStream } from 'node:fs'
import { mkdtemp, rm, readdir, stat, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, extname } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { createHmac } from 'node:crypto'
import pg from 'pg'
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

// ВАЖНО: берём env через `||`, а НЕ через destructuring-дефолты. Timeweb
// подставляет незаданную переменную как ПУСТУЮ СТРОКУ, а `= 'ru-1'` срабатывает
// только на undefined — из-за этого S3Client падал с «Region is missing» и
// воркер крутился в рестарте, не обрабатывая ни одной задачи. `||` ловит и
// пустую строку. Фолбэк на R2_* — как в приложении (src/lib/s3.ts).
const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URI || ''
const S3_ENDPOINT = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT || ''
const S3_REGION = process.env.S3_REGION || 'ru-1'
const S3_BUCKET = process.env.S3_BUCKET || process.env.R2_BUCKET || ''
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || ''
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || ''
const VIDEO_WEBHOOK_SECRET = process.env.VIDEO_WEBHOOK_SECRET || ''
const APP_INTERNAL_URL = process.env.APP_INTERNAL_URL || 'http://app:3000'
const POLL_INTERVAL_MS = process.env.POLL_INTERVAL_MS || '5000'
const MAX_ATTEMPTS = process.env.MAX_ATTEMPTS || '3'

const log = (...a) => console.log(new Date().toISOString(), '[worker]', ...a)

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2, idleTimeoutMillis: 10_000 })
const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
})

// Лесенка качеств. Рендишены выше исходника отбрасываем (не апскейлим).
const LADDER = [
  { height: 1080, vb: 5000, maxrate: '5350k', bufsize: '7500k', ab: 128 },
  { height: 720, vb: 2800, maxrate: '2996k', bufsize: '4200k', ab: 128 },
  { height: 480, vb: 1400, maxrate: '1498k', bufsize: '2100k', ab: 96 },
]

const CT = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.vtt': 'text/vtt',
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts })
    let err = ''
    p.stderr.on('data', (d) => { err += d.toString(); if (err.length > 8000) err = err.slice(-8000) })
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}: ${err.slice(-1200)}`))))
  })
}

function runJson(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = '', err = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve(JSON.parse(out)) : reject(new Error(`${cmd} exit ${code}: ${err.slice(-600)}`))))
  })
}

async function probe(file) {
  const info = await runJson('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file])
  const v = (info.streams || []).find((s) => s.codec_type === 'video')
  const hasAudio = (info.streams || []).some((s) => s.codec_type === 'audio')
  const width = v ? Number(v.width) : 0
  const height = v ? Number(v.height) : 0
  const duration = Number(info.format?.duration || v?.duration || 0)
  return { width, height, duration, hasAudio }
}

async function downloadOriginal(key, dest) {
  const res = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }))
  await pipeline(res.Body, createWriteStream(dest))
}

function isYandexDiskUrl(url) {
  try {
    const u = new URL(url)
    return /(^|\.)disk\.yandex\.(ru|com|net|by|kz|ua)$/.test(u.hostname) || u.hostname === 'yadi.sk'
  } catch { return false }
}

// Публичная ссылка Яндекс.Диска → прямая ссылка на скачивание (href живёт недолго,
// поэтому резолвим прямо перед загрузкой).
async function resolveYandexHref(publicUrl) {
  const api = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(publicUrl)}`
  const res = await fetch(api, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Яндекс.Диск: HTTP ${res.status}`)
  const j = await res.json()
  if (!j.href) throw new Error('Яндекс.Диск: нет прямой ссылки')
  return j.href
}

// Скачивание оригинала из внешнего источника (импорт по ссылке). Стримом на диск,
// без буферизации в память — важно для файлов на десятки ГБ.
async function downloadFromUrl(sourceUrl, dest) {
  const href = isYandexDiskUrl(sourceUrl) ? await resolveYandexHref(sourceUrl) : sourceUrl
  const res = await fetch(href, { redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`Загрузка источника: HTTP ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

async function uploadFile(localPath, key) {
  const body = createReadStream(localPath)
  const ct = CT[extname(localPath).toLowerCase()] || 'application/octet-stream'
  await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: body, ContentType: ct }))
}

// Рекурсивно заливает содержимое dir в S3 под prefix.
async function uploadDir(dir, prefix) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) await uploadDir(full, `${prefix}/${e.name}`)
    else await uploadFile(full, `${prefix}/${e.name}`)
  }
}

async function buildHls(input, outDir, meta) {
  const renditions = LADDER.filter((r) => r.height <= meta.height)
  if (!renditions.length) renditions.push({ ...LADDER[LADDER.length - 1], height: Math.max(144, meta.height || 480) })
  for (let i = 0; i < renditions.length; i++) await mkdir(join(outDir, String(i)), { recursive: true })

  const n = renditions.length
  const split = `[0:v]split=${n}${renditions.map((_, i) => `[v${i}]`).join('')}`
  const scales = renditions.map((r, i) => `[v${i}]scale=w=-2:h=${r.height}[v${i}out]`)
  const filter = [split, ...scales].join('; ')

  const args = ['-y', '-i', input, '-filter_complex', filter]
  renditions.forEach((r, i) => {
    args.push('-map', `[v${i}out]`, `-c:v:${i}`, 'libx264', `-b:v:${i}`, `${r.vb}k`, `-maxrate:v:${i}`, r.maxrate, `-bufsize:v:${i}`, r.bufsize)
  })
  if (meta.hasAudio) {
    renditions.forEach((r, i) => args.push('-map', 'a:0', `-c:a:${i}`, 'aac', `-b:a:${i}`, `${r.ab}k`, '-ac', '2'))
  }
  const vsm = renditions.map((_, i) => (meta.hasAudio ? `v:${i},a:${i}` : `v:${i}`)).join(' ')
  args.push(
    '-preset', 'veryfast', '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
    '-hls_time', '6', '-hls_playlist_type', 'vod', '-hls_flags', 'independent_segments',
    '-hls_segment_type', 'mpegts', '-master_pl_name', 'master.m3u8',
    '-var_stream_map', vsm,
    '-hls_segment_filename', join(outDir, '%v', 'seg_%03d.ts'),
    join(outDir, '%v', 'index.m3u8'),
  )
  await run('nice', ['-n', '10', 'ffmpeg', ...args])

  return renditions.map((r, i) => ({ height: r.height, bandwidth: (r.vb + (meta.hasAudio ? r.ab : 0)) * 1000, index: i }))
}

async function makePoster(input, out, t) {
  await run('ffmpeg', ['-y', '-ss', String(t), '-i', input, '-frames:v', '1', '-q:v', '3', out])
}

async function makeGif(input, out, t) {
  await run('ffmpeg', ['-y', '-ss', String(t), '-t', '3', '-i', input, '-vf', 'fps=10,scale=360:-2:flags=lanczos', out])
}

// Базовый сториборд: сетка миниатюр (5 в ряд) + WebVTT со ссылками #xywh.
// Best-effort — ошибка тут не должна валить всю задачу.
async function makeStoryboard(input, dir, meta) {
  const interval = Math.max(2, Math.round((meta.duration || 60) / 100))
  const count = Math.max(1, Math.ceil((meta.duration || 0) / interval))
  const cols = 5
  const rows = Math.ceil(count / cols)
  const thumbW = 160
  const aspect = meta.width && meta.height ? meta.width / meta.height : 16 / 9
  const thumbH = Math.max(2, Math.round(thumbW / aspect / 2) * 2)
  const spriteName = 'storyboard.jpg'
  await run('ffmpeg', ['-y', '-i', input, '-vf', `fps=1/${interval},scale=${thumbW}:${thumbH},tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', '4', join(dir, spriteName)])

  let vtt = 'WEBVTT\n\n'
  const fmt = (s) => {
    const h = String(Math.floor(s / 3600)).padStart(2, '0')
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
    const sec = String(Math.floor(s % 60)).padStart(2, '0')
    return `${h}:${m}:${sec}.000`
  }
  for (let i = 0; i < count; i++) {
    const start = i * interval
    const end = Math.min((i + 1) * interval, meta.duration || (i + 1) * interval)
    const x = (i % cols) * thumbW
    const y = Math.floor(i / cols) * thumbH
    vtt += `${fmt(start)} --> ${fmt(end)}\n${spriteName}#xywh=${x},${y},${thumbW},${thumbH}\n\n`
  }
  const { writeFile } = await import('node:fs/promises')
  await writeFile(join(dir, 'storyboard.vtt'), vtt, 'utf8')
  return { spriteName }
}

async function postWebhook(payload) {
  const body = JSON.stringify(payload)
  const sig = createHmac('sha256', VIDEO_WEBHOOK_SECRET).update(body).digest('hex')
  const res = await fetch(`${APP_INTERNAL_URL}/api/videos/webhook/asset-ready`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-signature': `sha256=${sig}` },
    body,
  })
  if (!res.ok) throw new Error(`webhook HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
}

async function claimJob() {
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    const r = await c.query(
      `SELECT id, video_id, tenant_id, playback_id, original_key, source_url, attempts
         FROM video_jobs
        WHERE status = 'queued'
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1`,
    )
    if (!r.rows.length) { await c.query('COMMIT'); return null }
    const job = r.rows[0]
    await c.query(`UPDATE video_jobs SET status='processing', attempts=attempts+1, locked_at=now(), updated_at=now() WHERE id=$1`, [job.id])
    await c.query('COMMIT')
    return job
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    c.release()
  }
}

async function finishJob(id, status, error) {
  await pool.query(`UPDATE video_jobs SET status=$2, error=$3, updated_at=now() WHERE id=$1`, [id, status, error ? String(error).slice(0, 1000) : null])
}

async function processJob(job) {
  const playbackId = job.playback_id
  log(`job ${job.id} → playback ${playbackId} (attempt ${job.attempts})`)
  const work = await mkdtemp(join(tmpdir(), `vod-${playbackId}-`))
  const input = join(work, 'input')
  const hlsDir = join(work, 'hls')
  const spriteDir = join(work, 'sprite')
  await mkdir(hlsDir, { recursive: true })
  await mkdir(spriteDir, { recursive: true })
  try {
    if (job.source_url) {
      log(`downloading from source url…`)
      await downloadFromUrl(job.source_url, input)
    } else {
      await downloadOriginal(job.original_key, input)
    }
    const meta = await probe(input)
    const posterT = Math.max(1, Math.floor((meta.duration || 10) * 0.1))

    const renditions = await buildHls(input, hlsDir, meta)
    await makePoster(input, join(work, 'poster.jpg'), posterT)
    await makeGif(input, join(work, 'preview.gif'), posterT).catch((e) => log('gif failed (non-fatal):', e.message))

    let spriteKey = null
    try {
      await makeStoryboard(input, spriteDir, meta)
      await uploadDir(spriteDir, `sprites/${playbackId}`)
      spriteKey = `sprites/${playbackId}/storyboard.vtt`
    } catch (e) { log('storyboard failed (non-fatal):', e.message) }

    // Заливаем HLS и превью.
    await uploadDir(hlsDir, `hls/${playbackId}`)
    await uploadFile(join(work, 'poster.jpg'), `posters/${playbackId}.jpg`)
    const gifKey = `preview/${playbackId}.gif`
    try { await uploadFile(join(work, 'preview.gif'), gifKey) } catch { /* нет gif — ок */ }

    await postWebhook({
      playbackId,
      videoId: job.video_id,
      status: 'ready',
      durationSec: Math.round(meta.duration || 0),
      renditions: renditions.map((r) => ({ height: r.height, bandwidth: r.bandwidth, key: `hls/${playbackId}/${r.index}/index.m3u8` })),
      masterKey: `hls/${playbackId}/master.m3u8`,
      posterKey: `posters/${playbackId}.jpg`,
      spriteKey,
      gifKey,
    })
    await finishJob(job.id, 'done', null)
    // Оригинал больше не нужен — HLS собран и залит в S3. Удаляем исходник,
    // чтобы не занимать место (у импорта по ссылке оригинала в нашем S3 и нет).
    if (job.original_key) {
      await s3
        .send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: job.original_key }))
        .then(() => log(`original ${job.original_key} deleted`))
        .catch((e) => log('cleanup original failed (non-fatal):', e.message))
    }
    log(`job ${job.id} done`)
  } catch (e) {
    log(`job ${job.id} error:`, e.message)
    const fatal = job.attempts >= Number(MAX_ATTEMPTS)
    await finishJob(job.id, fatal ? 'error' : 'queued', e.message)
    if (fatal) {
      await postWebhook({ playbackId, videoId: job.video_id, status: 'error', error: e.message }).catch((w) => log('error-webhook failed:', w.message))
    }
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {})
  }
}

let stopping = false
async function loop() {
  log('worker started; polling video_jobs')
  while (!stopping) {
    let job = null
    try { job = await claimJob() } catch (e) { log('claim error:', e.message) }
    if (job) { await processJob(job) }
    else { await new Promise((r) => setTimeout(r, Number(POLL_INTERVAL_MS))) }
  }
}

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { log('shutting down'); stopping = true; setTimeout(() => process.exit(0), 500) })
loop().catch((e) => { log('fatal:', e); process.exit(1) })
