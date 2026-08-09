import { S3Client, HeadObjectCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import type { ListObjectsV2CommandOutput } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Единый S3-клиент (Timeweb Cloud S3, path-style). Те же env, что и у плагина
 * storage-s3 в payload.config, с фолбэком на старые R2_*. Используется для
 * presigned-загрузок: браузер льёт файл напрямую в бакет, минуя приложение
 * (обходит лимит тела на прокси и не буферит файл в памяти сервера).
 */
export const S3_BUCKET = process.env.S3_BUCKET || process.env.R2_BUCKET || ''
const PUBLIC_BASE = (process.env.S3_PUBLIC_URL || process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '')

let client: S3Client | null = null
export function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: process.env.S3_ENDPOINT || process.env.R2_ENDPOINT || '',
      region: process.env.S3_REGION || 'ru-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '',
      },
    })
  }
  return client
}

/** Публичный URL объекта по ключу — тот же формат, что generateFileURL у media. */
export function publicUrl(key: string): string {
  return `${PUBLIC_BASE}/${key}`
}

/**
 * Presigned PUT для прямой загрузки из браузера. contentType ДОЛЖЕН совпасть с
 * заголовком Content-Type, который пришлёт клиент (иначе подпись не сойдётся).
 */
export async function presignPut(key: string, contentType: string, expiresIn = 600): Promise<string> {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: contentType }), { expiresIn })
}

/**
 * Presigned GET — краткоживущая ссылка на приватный объект для плеера.
 * Используется подписывающим HLS-прокси: JWT проверяется у нас, затем 302 на
 * этот URL, и байты идут S3 → клиент напрямую, минуя приложение.
 */
export async function presignGet(key: string, expiresIn = 120): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), { expiresIn })
}

/** Проверка, что объект реально загружен (перед созданием записи). Размер/тип или null. */
export async function headObject(key: string): Promise<{ size: number; contentType: string | null } | null> {
  try {
    const r = await s3().send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }))
    return { size: Number(r.ContentLength ?? 0), contentType: r.ContentType ?? null }
  } catch {
    return null
  }
}

/** Удалить объект из S3 (при удалении аудио/файла, чтобы не копить сирот). */
export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
}

/**
 * Удаляет ВСЕ объекты под префиксом (лесенка HLS, спрайты и т.п.). В S3 нет
 * «удалить папку» — листаем постранично и удаляем пачками по 1000. Best-effort:
 * ошибки не бросаем, чтобы не блокировать удаление записи видео.
 */
export async function deletePrefix(prefix: string): Promise<void> {
  if (!prefix) return
  let token: string | undefined = undefined
  try {
    do {
      const list: ListObjectsV2CommandOutput = await s3().send(
        new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix: prefix, ContinuationToken: token }),
      )
      const objects = (list.Contents || []).map((o) => ({ Key: o.Key! })).filter((o) => o.Key)
      if (objects.length) {
        await s3().send(new DeleteObjectsCommand({ Bucket: S3_BUCKET, Delete: { Objects: objects, Quiet: true } }))
      }
      token = list.IsTruncated ? list.NextContinuationToken : undefined
    } while (token)
  } catch {
    /* best-effort: не блокируем удаление видео из-за чистки бакета */
  }
}

/** Ключ объекта из публичного URL (обратное к publicUrl). null, если не наш URL. */
export function keyFromPublicUrl(url: string): string | null {
  if (!url) return null
  const base = PUBLIC_BASE ? PUBLIC_BASE + '/' : ''
  return base && url.startsWith(base) ? url.slice(base.length) : null
}
