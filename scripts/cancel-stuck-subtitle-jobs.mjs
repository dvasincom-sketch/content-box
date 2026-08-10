// Отменить зависшие задачи субтитров: whisper таймаутит на длинном видео и
// крутит очередь. Помечает kind='subtitles' в статусах queued/processing как
// 'error'. Дедуп в коде (enqueueSubtitleJob) не даст им наплодиться снова.
// НЕ используйте requeue-video-jobs для этого — он бы ПЕРЕЗАПУСТИЛ их на 2 часа.
//
// Запуск на Mac:            node scripts/cancel-stuck-subtitle-jobs.mjs
// Только одно видео:        PLAYBACK=29d7fab4a03ee7ec970b17c5 node scripts/cancel-stuck-subtitle-jobs.mjs
import 'dotenv/config'
import pg from 'pg'

const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.DATABASE_URI })
await c.connect()
try {
  const pb = process.env.PLAYBACK || ''
  const where = pb ? 'AND playback_id = $1' : ''
  const params = pb ? [pb] : []
  const r = await c.query(
    `UPDATE video_jobs
        SET status='error', error='cancelled: stuck subtitles', updated_at=now()
      WHERE kind='subtitles' AND status IN ('queued','processing') ${where}
      RETURNING id, video_id, playback_id, attempts`,
    params,
  )
  console.log(`Отменено зависших задач субтитров: ${r.rowCount}`)
  for (const row of r.rows) console.log(` #${row.id} video=${row.video_id} pb=${row.playback_id} attempts=${row.attempts}`)
} finally {
  await c.end()
}
