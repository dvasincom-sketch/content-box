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
    /** Профиль сжатия (fast|balanced|compact|quality). Штампуется на задачу. */
    profile?: string | null
  },
): Promise<void> {
  await sqlRows(
    payload,
    `INSERT INTO "video_jobs" ("video_id","tenant_id","playback_id","original_key","source_url","status","profile")
     VALUES ($1,$2,$3,$4,$5,'queued',$6)`,
    [
      Number(args.videoId),
      args.tenantId != null ? Number(args.tenantId) : null,
      args.playbackId,
      args.originalKey ?? null,
      args.sourceUrl ?? null,
      args.profile || 'balanced',
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
  // Дедуп: не плодим задачи, если для видео уже есть активная (queued/processing)
  // задача на субтитры — иначе повторные клики «Сгенерировать» и авто-вебхук
  // забивают очередь дублями (каждая — длинный whisper-прогон).
  await sqlRows(
    payload,
    `INSERT INTO "video_jobs" ("video_id","tenant_id","playback_id","status","kind")
     SELECT $1,$2,$3,'queued','subtitles'
     WHERE NOT EXISTS (
       SELECT 1 FROM "video_jobs"
       WHERE "video_id" = $1 AND "kind" = 'subtitles' AND "status" IN ('queued','processing')
     )`,
    [Number(args.videoId), args.tenantId != null ? Number(args.tenantId) : null, args.playbackId],
  )
}
