import { withAuthor, apiOk, apiError } from '@/app/(studio)/studio/api/_lib'

/**
 * Тепловая карта/удержание своего видео для студии.
 * GET ?videoId=123 → { buckets:number[100], starts, plays }
 *  - buckets[b] — сколько раз проигран процентный слот b (0..99);
 *  - starts     — buckets[0], база для кривой удержания;
 *  - plays      — суммарно проигранных слотов (объём просмотра).
 */
export const runtime = 'nodejs'

type PoolLike = { query: (t: string, p: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }

export const GET = withAuthor(async ({ req, payload, tenantId }) => {
  const videoId = Number(req.nextUrl.searchParams.get('videoId'))
  if (!Number.isInteger(videoId) || videoId <= 0) return apiError('Не указано видео')

  const v: any = await payload.findByID({ collection: 'videos', id: videoId, depth: 0, overrideAccess: true }).catch(() => null)
  const vt = v && (typeof v.tenant === 'object' ? v.tenant.id : v.tenant)
  if (!v || Number(vt) !== Number(tenantId)) return apiError('Видео не найдено', 404)

  const pool = (payload.db as unknown as { pool?: PoolLike }).pool
  const buckets = new Array(100).fill(0)
  if (pool?.query) {
    try {
      const res = await pool.query('SELECT bucket, plays FROM video_heatmap WHERE video_id = $1', [videoId])
      for (const r of res.rows) {
        const b = Number(r.bucket)
        if (b >= 0 && b < 100) buckets[b] = Number(r.plays) || 0
      }
    } catch {
      /* таблицы может не быть до миграции — вернём нули */
    }
  }
  const starts = buckets[0] || 0
  const plays = buckets.reduce((a, b) => a + b, 0)
  return apiOk({ buckets, starts, plays })
})
