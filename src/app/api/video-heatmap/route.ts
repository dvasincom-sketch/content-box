import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { tenantIdFromRequestHeaders } from '@/lib/tenantByHost'

/**
 * Приём beacon'ов удержания просмотра своего видео. Плеер шлёт набор процентных
 * слотов (0..99), реально проигранных с прошлой отправки; здесь инкрементим
 * счётчики в video_heatmap (UPSERT). Аналитика не критична — на любой ошибке
 * тихо отвечаем 204, чтобы не мешать просмотру. Пишем только для своего видео
 * текущего тенанта (проверка по хосту + принадлежности).
 */
export const runtime = 'nodejs'

type PoolLike = { query: (t: string, p: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return new NextResponse(null, { status: 204 }) }

  const videoId = Math.floor(Number(body?.videoId))
  const rawBuckets = Array.isArray(body?.buckets) ? body.buckets : []
  if (!Number.isInteger(videoId) || videoId <= 0 || !rawBuckets.length) return new NextResponse(null, { status: 204 })

  const buckets = Array.from(
    new Set(rawBuckets.map((b: unknown) => Math.floor(Number(b))).filter((b: number) => Number.isInteger(b) && b >= 0 && b <= 99)),
  ).slice(0, 100) as number[]
  if (!buckets.length) return new NextResponse(null, { status: 204 })

  const tenantId = await tenantIdFromRequestHeaders(req.headers)
  if (!tenantId) return new NextResponse(null, { status: 204 })

  try {
    const payload = await getPayload({ config: await config })
    const pool = (payload.db as unknown as { pool?: PoolLike }).pool
    if (!pool?.query) return new NextResponse(null, { status: 204 })

    const chk = await pool.query(
      `SELECT 1 FROM videos WHERE id = $1 AND tenant_id = $2 AND provider = 'self' LIMIT 1`,
      [videoId, Number(tenantId)],
    )
    if (!chk.rows.length) return new NextResponse(null, { status: 204 })

    const values = buckets.map((_, i) => `($1, $${i + 2}, 1)`).join(', ')
    await pool.query(
      `INSERT INTO video_heatmap (video_id, bucket, plays) VALUES ${values}
       ON CONFLICT (video_id, bucket) DO UPDATE SET plays = video_heatmap.plays + 1`,
      [videoId, ...buckets],
    )
  } catch {
    /* аналитика не критична */
  }
  return new NextResponse(null, { status: 204 })
}
