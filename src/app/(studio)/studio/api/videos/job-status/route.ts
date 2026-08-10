import { withAuthor, apiOk, apiError } from '@/app/(studio)/studio/api/_lib'
import { sqlRows } from '@/lib/sql'

/**
 * Статус фоновой задачи субтитров (whisper) для видео. Студия опрашивает роут,
 * пока идёт распознавание, и показывает «в очереди / распознаём / готово /
 * ошибка» вместо статичной надписи. Берём ПОСЛЕДНЮЮ задачу kind='subtitles'
 * (по убыванию id). Доступ — только владельцу тенанта этого видео.
 *
 * GET ?videoId=123 → { ok, job: { status, error, attempts, updatedAt } | null }
 */
export const runtime = 'nodejs'

export const GET = withAuthor(async ({ req, payload, tenantId }) => {
  const videoId = Number(req.nextUrl.searchParams.get('videoId') || '')
  if (!Number.isInteger(videoId) || videoId <= 0) return apiError('Нет videoId')

  // Проверяем принадлежность видео тенанту (jobs.tenant_id бывает null у авто-задач).
  const video: any = await payload
    .findByID({ collection: 'videos', id: videoId, depth: 0, overrideAccess: true })
    .catch(() => null)
  const vt = video && (typeof video.tenant === 'object' ? video.tenant?.id : video.tenant)
  if (!video || Number(vt) !== Number(tenantId)) return apiError('Видео не найдено', 404)

  const rows = await sqlRows<{ status: string; error: string | null; attempts: number; updated_at: string }>(
    payload,
    `SELECT status, error, attempts, updated_at
       FROM "video_jobs"
      WHERE video_id = $1 AND kind = 'subtitles'
      ORDER BY id DESC
      LIMIT 1`,
    [videoId],
  ).catch(() => [])

  const job = rows[0] || null
  return apiOk({
    job: job ? { status: job.status, error: job.error, attempts: job.attempts, updatedAt: job.updated_at } : null,
  })
})
