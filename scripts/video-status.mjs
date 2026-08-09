// Диагностика видео-пайплайна: состояние очереди транскода и своих видео.
// Запуск на Mac (где доступна БД): node scripts/video-status.mjs
import 'dotenv/config'
import pg from 'pg'

const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.DATABASE_URI })
await c.connect()
try {
  const jobsByStatus = await c.query(`SELECT status, count(*)::int n FROM video_jobs GROUP BY status ORDER BY status`)
  console.log('\n=== video_jobs по статусам ===')
  if (!jobsByStatus.rows.length) console.log('(таблица пуста — ни одной задачи не создано)')
  for (const r of jobsByStatus.rows) console.log(` ${r.status}: ${r.n}`)

  const recent = await c.query(`
    SELECT id, video_id, playback_id, status, attempts,
           left(coalesce(error,''), 200) AS error, created_at
      FROM video_jobs ORDER BY id DESC LIMIT 10`)
  console.log('\n=== последние 10 задач ===')
  for (const r of recent.rows) {
    console.log(` #${r.id} video=${r.video_id} pb=${r.playback_id} status=${r.status} attempts=${r.attempts}${r.error ? ' ERR="'+r.error+'"' : ''}`)
  }

  const vids = await c.query(`
    SELECT id, title, asset_status, playback_id, poster_key IS NOT NULL AS has_poster, created_at
      FROM videos WHERE provider='self' ORDER BY id DESC LIMIT 10`)
  console.log('\n=== последние self-видео ===')
  if (!vids.rows.length) console.log('(нет видео provider=self — форма ещё не создавала записи)')
  for (const r of vids.rows) console.log(` #${r.id} "${r.title}" asset=${r.asset_status} pb=${r.playback_id} poster=${r.has_poster}`)
  console.log('')
} finally {
  await c.end()
}
