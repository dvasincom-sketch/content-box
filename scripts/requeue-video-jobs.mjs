// Вернуть в очередь застрявшие/упавшие задачи транскода (после починки воркера).
// Сбрасывает status→'queued', attempts→0 для 'error' и зависших 'processing'.
// Оригиналы (для загрузок файлом) не удаляются до успеха, так что перегон
// безопасен; импорт по ссылке воркер перекачает заново.
// Запуск на Mac: node scripts/requeue-video-jobs.mjs
import 'dotenv/config'
import pg from 'pg'

const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.DATABASE_URI })
await c.connect()
try {
  const r = await c.query(
    `UPDATE video_jobs
        SET status='queued', attempts=0, error=NULL, locked_at=NULL, updated_at=now()
      WHERE status IN ('error','processing')
      RETURNING id, video_id, playback_id`,
  )
  console.log(`Перезапущено задач: ${r.rowCount}`)
  for (const row of r.rows) console.log(` #${row.id} video=${row.video_id} pb=${row.playback_id}`)
  // Соответствующие видео возвращаем в «обработку» (если были помечены ошибкой).
  const v = await c.query(
    `UPDATE videos SET asset_status='processing', asset_error=NULL
      WHERE provider='self' AND asset_status='error' RETURNING id`,
  )
  if (v.rowCount) console.log(`Видео возвращено в обработку: ${v.rowCount}`)
} finally {
  await c.end()
}
