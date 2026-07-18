import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { slugify } from '@/lib/slugify'
import { resolveDirectUrl } from '@/lib/cfStream'
import { kinescopeUploadFromUrl } from '@/lib/kinescope'

/**
 * Создание видео на Kinescope из внешней ссылки (аналог CF create-from-url).
 * Kinescope сам скачивает файл по URL (прямая ссылка или YouTube).
 *
 * Поток: валидируем → resolveDirectUrl (Яндекс.Диск → прямая) →
 * kinescopeUploadFromUrl → получаем video_id → создаём запись Videos с
 * provider='kinescope', videoRef=id. Готовность проверяем роутом status.
 *
 * Body: { title, url, minTierId?, isPreview?, categoryId? }
 */
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let data: any
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  const title = String(data.title || '').trim()
  const url = String(data.url || '').trim()
  if (!title) return NextResponse.json({ error: 'Укажите название' }, { status: 400 })
  if (!isHttpUrl(url)) {
    return NextResponse.json(
      { error: 'Укажите прямую ссылку на видеофайл (http/https) или YouTube' },
      { status: 400 },
    )
  }

  const payload = await getPayload({ config: await config })

  // 1) Запускаем загрузку в Kinescope
  let videoId: string
  try {
    // Яндекс.Диск отдаёт ссылку на страницу — конвертируем в прямую.
    // YouTube и прочие прямые URL Kinescope принимает как есть.
    const host = safeHost(url)
    const isYandexDisk =
      host === 'disk.yandex.ru' || host === 'disk.yandex.com' ||
      host === 'yadi.sk' || host.endsWith('.yadi.sk')
    const finalUrl = isYandexDisk ? await resolveDirectUrl(url) : url

    const video = await kinescopeUploadFromUrl({ url: finalUrl, title })
    videoId = video.id
    if (!videoId) throw new Error('Kinescope не вернул id видео')
  } catch (e: any) {
    return NextResponse.json(
      { error: `Kinescope: ${e?.message || 'не удалось начать загрузку'}` },
      { status: 502 },
    )
  }

  // 2) Создаём запись Videos с provider=kinescope
  try {
    const doc = await payload.create({
      collection: 'videos',
      data: {
        title,
        slug: slugify(title) || videoId,
        provider: 'kinescope',
        videoRef: videoId,
        minTier: numOrNull(data.minTierId),
        isPreview: Boolean(data.isPreview),
        category: numOrNull(data.categoryId),
        tenant: author.tenantId,
      } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, id: doc.id, videoId })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Видео ушло в Kinescope, но запись создать не удалось' },
      { status: 500 },
    )
  }
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
function safeHost(s: string): string {
  try {
    return new URL(s).hostname.toLowerCase()
  } catch {
    return ''
  }
}
function numOrNull(v: any): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
