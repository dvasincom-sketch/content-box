import { withAuthor, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Лёгкий опрос статуса обработки видео для студии. Возвращает assetStatus и
 * прогресс кодирования (0..99, из очереди video_jobs) по списку id — чтобы
 * список видео обновлял «Обрабатывается NN% → Готово» БЕЗ полного router.refresh().
 *
 * GET ?ids=1,2,3 → { ok, statuses: { [id]: '…' }, progress: { [id]: number } }
 */
export const runtime = 'nodejs'

type PoolLike = { query: (t: string, p: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }

export const GET = withAuthor(async ({ req, payload, tenantId }) => {
  const raw = req.nextUrl.searchParams.get('ids') || ''
  const ids = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 100)
  if (!ids.length) return apiOk({ statuses: {}, progress: {} })

  const res = await payload.find({
    collection: 'videos',
    where: { and: [{ tenant: { equals: tenantId } }, { id: { in: ids } }] },
    depth: 0,
    limit: 100,
    overrideAccess: true,
  })
  const statuses: Record<string, string | null> = {}
  for (const v of res.docs as any[]) statuses[String(v.id)] = (v.assetStatus as string) || null

  // Прогресс кодирования из очереди video_jobs (высокочастотные апдейты воркера
  // идут мимо Payload — читаем напрямую из пула). Только активная задача.
  const progress: Record<string, number> = {}
  try {
    const pool = (payload.db as unknown as { pool?: PoolLike }).pool
    if (pool?.query) {
      const r = await pool.query(
        `SELECT DISTINCT ON (video_id) video_id, progress
           FROM video_jobs
          WHERE video_id = ANY($1) AND status = 'processing'
          ORDER BY video_id, updated_at DESC`,
        [ids],
      )
      for (const row of r.rows) progress[String(row.video_id)] = Number(row.progress) || 0
    }
  } catch {
    /* прогресс не критичен */
  }

  return apiOk({ statuses, progress })
})
