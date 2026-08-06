import { S3Client, HeadObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
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

/** Ключ объекта из публичного URL (обратное к publicUrl). null, если не наш URL. */
export function keyFromPublicUrl(url: string): string | null {
  if (!url) return null
  const base = PUBLIC_BASE ? PUBLIC_BASE + '/' : ''
  return base && url.startsWith(base) ? url.slice(base.length) : null
}
