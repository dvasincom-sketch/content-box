import type { Payload } from 'payload'

/**
 * Агрегированная аналитика по ВСЕМ видео тенанта — для раздела
 * «Аналитика → Видео». Считаем прямым SQL по тем же данным, что и карточка
 * одного видео (роут /studio/videos/heatmap):
 *
 *  - `video_heatmap(video_id, bucket, plays)` — сколько раз проигран каждый
 *    процентный слот 0..99. bucket=0 — «проигрывания» (старты, с ре-вотчами),
 *    bucket=50 — досмотр до середины, bucket=99 — до конца;
 *  - `views` (target_type='video') — уникальные зрители (одна строка на
 *    подписчика+видео), есть tenant_id;
 *  - `videos` — сами видео (tenant_id, provider). provider='audio' — это
 *    студийные аудио-публикации, их из видео-аналитики исключаем.
 *
 * Формулы совпадают с карточкой одного видео, но взвешены по стартам:
 *  - ср. досмотр = Σplays / Σstarts (%);
 *  - до середины = Σbucket50 / Σstarts (%);
 *  - до конца    = Σbucket99 / Σstarts (%).
 *
 * Ошибки БД (нет таблиц до миграции и т.п.) не должны ронять страницу —
 * возвращаем null, секцию показываем как «данных пока нет».
 */

export interface VideoAggRow {
  id: number
  title: string
  viewers: number
  starts: number
  avgWatch: number
  mid: number
  end: number
}

export interface VideoAggStats {
  totalVideos: number
  viewers: number // уникальные зрители (distinct subscriber по всем видео)
  starts: number // суммарно проигрываний
  avgWatch: number // средний досмотр, %
  mid: number // до середины, %
  end: number // до конца, %
  rows: VideoAggRow[]
}

type PoolLike = { query: (t: string, p: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }
const num = (v: unknown): number => Number(v) || 0

export async function getVideoAggStats(payload: Payload, tenantId: number | string): Promise<VideoAggStats | null> {
  const pool = (payload.db as unknown as { pool?: PoolLike }).pool
  if (!pool || typeof pool.query !== 'function') return null

  try {
    // Итоги по удержанию (heatmap × videos тенанта).
    const totalsSql = `
      SELECT
        COALESCE(SUM(h.plays), 0)                              AS play_slots,
        COALESCE(SUM(h.plays) FILTER (WHERE h.bucket = 0), 0)  AS starts,
        COALESCE(SUM(h.plays) FILTER (WHERE h.bucket = 50), 0) AS mid,
        COALESCE(SUM(h.plays) FILTER (WHERE h.bucket = 99), 0) AS ends
      FROM video_heatmap h
      JOIN videos v ON v.id = h.video_id
      WHERE v.tenant_id = $1 AND COALESCE(v.provider, '') <> 'audio'`
    // Зрители: distinct подписчик по всем видео + всего видео тенанта.
    const viewersSql = `SELECT COUNT(DISTINCT subscriber_id) AS uniq FROM views WHERE tenant_id = $1 AND target_type = 'video'`
    const countSql = `SELECT COUNT(*) AS n FROM videos WHERE tenant_id = $1 AND COALESCE(provider, '') <> 'audio'`
    // Разбивка по видео (топ по стартам).
    const rowsSql = `
      SELECT v.id, v.title,
             COALESCE(hm.starts, 0)     AS starts,
             COALESCE(hm.play_slots, 0) AS play_slots,
             COALESCE(hm.mid, 0)        AS mid,
             COALESCE(hm.ends, 0)       AS ends,
             COALESCE(vw.viewers, 0)    AS viewers
      FROM videos v
      LEFT JOIN (
        SELECT video_id,
               SUM(plays) FILTER (WHERE bucket = 0)  AS starts,
               SUM(plays)                            AS play_slots,
               SUM(plays) FILTER (WHERE bucket = 50) AS mid,
               SUM(plays) FILTER (WHERE bucket = 99) AS ends
        FROM video_heatmap GROUP BY video_id
      ) hm ON hm.video_id = v.id
      LEFT JOIN (
        SELECT video_id, COUNT(*) AS viewers
        FROM views WHERE target_type = 'video' GROUP BY video_id
      ) vw ON vw.video_id = v.id
      WHERE v.tenant_id = $1 AND COALESCE(v.provider, '') <> 'audio'
      ORDER BY starts DESC NULLS LAST, viewers DESC NULLS LAST
      LIMIT 50`

    const [totalsR, viewersR, countR, rowsR] = await Promise.all([
      pool.query(totalsSql, [tenantId]),
      pool.query(viewersSql, [tenantId]),
      pool.query(countSql, [tenantId]),
      pool.query(rowsSql, [tenantId]),
    ])

    const t = totalsR.rows[0] || {}
    const starts = num(t.starts)
    const playSlots = num(t.play_slots)
    const pct = (part: number) => (starts > 0 ? Math.round((part / starts) * 100) : 0)

    const rows: VideoAggRow[] = (rowsR.rows || []).map((r) => {
      const s = num(r.starts)
      return {
        id: num(r.id),
        title: (r.title as string) || 'Без названия',
        viewers: num(r.viewers),
        starts: s,
        avgWatch: s > 0 ? Math.round(num(r.play_slots) / s) : 0,
        mid: s > 0 ? Math.round((num(r.mid) / s) * 100) : 0,
        end: s > 0 ? Math.round((num(r.ends) / s) * 100) : 0,
      }
    })

    return {
      totalVideos: num(countR.rows[0]?.n),
      viewers: num(viewersR.rows[0]?.uniq),
      starts,
      avgWatch: starts > 0 ? Math.round(playSlots / starts) : 0,
      mid: pct(num(t.mid)),
      end: pct(num(t.ends)),
      rows,
    }
  } catch {
    return null
  }
}
