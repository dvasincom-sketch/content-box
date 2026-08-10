import type { Payload } from 'payload'
import { sqlRows } from '@/lib/sql'

/**
 * Очередь транскода на таблице video_jobs (Postgres). Пишем задачу здесь, а
 * отдельный воркер-сервис забирает её через FOR UPDATE SKIP LOCKED, гоняет
 * FFmpeg и присылает webhook video.asset.ready. Без Redis — на MVP хватает БД.
 */
export async function enqueueTranscode(
  payload: Payload,
  args: {
    videoId: number | string
    tenantId: number | string | null
    playbackId: string
    /** Ключ оригинала в нашем S3 (загрузка файлом). */
    originalKey?: string | null
    /** Внешний источник (импорт по ссылке, напр. Яндекс.Диск) — воркер качает сам. */
    sourceUrl?: string | null
  },
): Promise<void> {
  await sqlRows(
    payload,
    `INSERT INTO "video_jobs" ("video_id","tenant_id","playback_id","original_key","source_url","status")
     VALUES ($1,$2,$3,$4,$5,'queued')`,
    [
      Number(args.videoId),
      args.tenantId != null ? Number(args.tenantId) : null,
      args.playbackId,
      args.originalKey ?? null,
      args.sourceUrl ?? null,
    ],
  )
}


/**
 * Задача on-demand генерации субтитров для УЖЕ готового видео (оригинала нет —
 * воркер берёт аудио из HLS). kind='subtitles'; original_key/source_url пустые.
 */
export async function enqueueSubtitleJob(
  payload: Payload,
  args: { videoId: number | string; tenantId: number | string | null; playbackId: string },
): Promise<void> {
  await sqlRows(
    payload,
    `INSERT INTO "video_jobs" ("video_id","tenant_id","playback_id","status","kind")
     VALUES ($1,$2,$3,'queued','subtitles')`,
    [Number(args.videoId), args.tenantId != null ? Number(args.tenantId) : null, args.playbackId],
  )
}
