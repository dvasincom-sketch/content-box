import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { streamCreateTusUpload, buildUploadMetadata } from '@/lib/cfStream'

/**
 * Выдаёт браузеру одноразовый TUS upload-URL для прямой загрузки видео в
 * Cloudflare Stream (минуя наш сервер). API-токен остаётся на сервере.
 *
 * Body: { size: number (байты), name?: string }
 * Ответ: { uploadURL, uid }
 *
 * Видео сразу помечается requireSignedURLs — защищённое, доступ по подписке.
 */
export const runtime = 'nodejs'

export const POST = withAuthor(async ({ req }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const size = Number(data.size)
  if (!Number.isFinite(size) || size <= 0) {
    return apiError('Не указан размер файла')
  }
  // здравый лимит — 20 ГБ, чтобы отсечь мусор
  if (size > 20 * 1024 * 1024 * 1024) {
    return apiError('Файл слишком большой (>20 ГБ)')
  }

  const name = String(data.name || 'video').slice(0, 200)

  try {
    const metadata = buildUploadMetadata({ name, requireSignedURLs: true })
    const { uploadURL, uid } = await streamCreateTusUpload({
      uploadLength: size,
      uploadMetadata: metadata,
    })
    return apiOk({ uploadURL, uid })
  } catch (e: any) {
    return apiError(`Cloudflare Stream: ${e?.message || 'не удалось начать загрузку'}`, 502)
  }
})
