import { S3Client, HeadObjectCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, ListPartsCommand } from '@aws-sdk/client-s3'
import type { ListObjectsV2CommandOutput, ListPartsCommandOutput } from '@aws-sdk/client-s3'
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

/* ────────────────────────────────────────────────────────────────────────────
 * Multipart-загрузка больших оригиналов (концерты 6–10 ГБ). Один presigned PUT
 * не годится: S3 не принимает объект больше 5 ГиБ одной частью, и на плохой
 * сети большой файл рвётся целиком. Поэтому: инициируем multipart, выдаём
 * presigned URL на каждую часть, браузер льёт части напрямую в S3, а завершаем
 * на сервере — собираем ETag'и частей через ListParts (браузеру НЕ нужно читать
 * заголовок ETag ответа S3, что снимает требование CORS ExposeHeaders: ETag).
 * ──────────────────────────────────────────────────────────────────────────── */

/** Инициировать multipart-загрузку. Возвращает UploadId. */
export async function createMultipart(key: string, contentType: string): Promise<string> {
  const r = await s3().send(new CreateMultipartUploadCommand({ Bucket: S3_BUCKET, Key: key, ContentType: contentType }))
  if (!r.UploadId) throw new Error('S3 не вернул UploadId')
  return r.UploadId
}

/** Presigned PUT для одной части (PartNumber от 1). ContentType не подписываем,
 *  чтобы браузер мог слать часть без совпадения заголовков. */
export async function presignUploadPart(key: string, uploadId: string, partNumber: number, expiresIn = 6 * 3600): Promise<string> {
  return getSignedUrl(
    s3(),
    new UploadPartCommand({ Bucket: S3_BUCKET, Key: key, UploadId: uploadId, PartNumber: partNumber }),
    { expiresIn },
  )
}

/** Завершить multipart: собираем список частей на сервере (ListParts) и
 *  вызываем CompleteMultipartUpload. Так браузеру не нужно читать ETag'и. */
export async function completeMultipartFromListing(key: string, uploadId: string): Promise<void> {
  const parts: { ETag: string; PartNumber: number }[] = []
  let marker: string | undefined = undefined
  do {
    const r: ListPartsCommandOutput = await s3().send(
      new ListPartsCommand({ Bucket: S3_BUCKET, Key: key, UploadId: uploadId, PartNumberMarker: marker }),
    )
    for (const p of r.Parts || []) {
      if (p.ETag && p.PartNumber != null) parts.push({ ETag: p.ETag, PartNumber: p.PartNumber })
    }
    marker = r.IsTruncated ? r.NextPartNumberMarker : undefined
  } while (marker)
  if (parts.length === 0) throw new Error('Ни одна часть не загрузилась')
  parts.sort((a, b) => a.PartNumber - b.PartNumber)
  await s3().send(
    new CompleteMultipartUploadCommand({
      Bucket: S3_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }),
  )
}

/** Отменить multipart (best-effort) — чтобы не копить недособранные загрузки. */
export async function abortMultipart(key: string, uploadId: string): Promise<void> {
  try {
    await s3().send(new AbortMultipartUploadCommand({ Bucket: S3_BUCKET, Key: key, UploadId: uploadId }))
  } catch {
    /* best-effort */
  }
}

/**
 * Presigned GET — краткоживущая ссылка на приватный объект для плеера.
 * Используется подписывающим HLS-прокси: JWT проверяется у нас, затем 302 на
 * этот URL, и байты идут S3 → клиент напрямую, минуя приложение.
 */
export async function presignGet(key: string, expiresIn = 120): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), { expiresIn })
}

/** Прямая заливка небольшого объекта (напр. VTT-субтитры) из приложения. */
export async function putObject(key: string, body: string | Buffer, contentType: string): Promise<void> {
  await s3().send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: body, ContentType: contentType }))
}

/** Текст объекта S3 (напр. VTT-транскрипт для саммари). null при ошибке. */
export async function getObjectText(key: string): Promise<string | null> {
  try {
    const r = await s3().send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }))
    return await (r.Body as unknown as { transformToString: () => Promise<string> }).transformToString()
  } catch {
    return null
  }
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
