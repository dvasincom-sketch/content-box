import { NextResponse, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Webhook транскод-воркера: video.asset.ready.
 *
 * Воркер (отдельный сервис) закончил HLS-транскод и залил артефакты в S3 —
 * здесь проставляем видео assetStatus + ключи артефактов. Роут ПУБЛИЧНЫЙ
 * (воркер ходит по внутренней сети compose), поэтому защищён HMAC-подписью
 * тела: заголовок x-signature = "sha256=<hex>" по сырому body с секретом
 * VIDEO_WEBHOOK_SECRET. Видео ищем по playbackId (он уникален между тенантами).
 *
 * Body: { playbackId, status:'ready'|'error', durationSec?, renditions?, masterKey?, posterKey?, spriteKey?, gifKey?, error? }
 */
export const runtime = 'nodejs'

function verify(raw: string, header: string | null): boolean {
  const secret = process.env.VIDEO_WEBHOOK_SECRET || ''
  if (!secret || !header) return false
  const expected = createHmac('sha256', secret).update(raw).digest('hex')
  const got = header.replace(/^sha256=/, '')
  const a = Buffer.from(got, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length) return false
  try { return timingSafeEqual(a, b) } catch { return false }
}

export async function POST(req: NextRequest) {
  const raw = await req.text()
  if (!verify(raw, req.headers.get('x-signature'))) {
    return NextResponse.json({ error: 'Неверная подпись' }, { status: 401 })
  }

  let data: any
  try { data = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 }) }

  const playbackId = String(data.playbackId || '').trim()
  if (!playbackId) return NextResponse.json({ error: 'Нет playbackId' }, { status: 400 })

  try {
    const payload = await getPayload({ config: await config })
    const found = await payload.find({
      collection: 'videos',
      where: { playbackId: { equals: playbackId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const video = found.docs[0]
    if (!video) return NextResponse.json({ error: 'Видео не найдено' }, { status: 404 })

    // Авто-субтитры от воркера (whisper): добавляем дорожку, НЕ затирая ручные
    // треки автора того же языка (dedup по lang).
    let subsPatch: unknown = undefined
    if (Array.isArray(data.subtitles) && data.subtitles.length) {
      const existing = Array.isArray((video as any).subtitles) ? ((video as any).subtitles as any[]) : []
      const langs = new Set(existing.map((sx) => String(sx?.lang)))
      const add = data.subtitles
        .filter((sx: any) => sx && sx.lang && sx.key && !langs.has(String(sx.lang)))
        .map((sx: any) => ({ lang: String(sx.lang), label: String(sx.label || sx.lang), key: String(sx.key) }))
      if (add.length) subsPatch = [...existing, ...add]
    }

    const chaptersPatch =
      Array.isArray(data.chapters) && data.chapters.length
        ? data.chapters
            .filter((c: any) => c && typeof c.start === 'number')
            .map((c: any) => ({ start: Math.max(0, Math.floor(Number(c.start))), title: String(c.title || '').slice(0, 120) }))
        : undefined

    // Субтитры реально поменялись → старое саммари Аси устарело (оно строилось по
    // прежнему транскрипту). Сбрасываем его в null, чтобы пересобралось по свежим
    // субтитрам при следующем запросе. Только если саммари было (без лишних записей).
    const invalidateSummary = subsPatch && (video as any).summary ? { summary: null } : {}

    // status='subtitles' — on-demand генерация для готового видео: обновляем ТОЛЬКО
    // дорожки/главы, не трогая assetStatus и ключи артефактов.
    let patch: Record<string, unknown>
    if (data.status === 'error') {
      patch = { assetStatus: 'error', assetError: String(data.error || 'Ошибка транскодинга').slice(0, 500) }
    } else if (data.status === 'subtitles') {
      patch = {
        ...(subsPatch ? { subtitles: subsPatch } : {}),
        ...(chaptersPatch ? { chapters: chaptersPatch } : {}),
        ...invalidateSummary,
      }
      if (!Object.keys(patch).length) return NextResponse.json({ ok: true }) // нечего обновлять
    } else {
      patch = {
        assetStatus: 'ready',
        renditions: Array.isArray(data.renditions) ? data.renditions : null,
        posterKey: data.posterKey || null,
        spriteKey: data.spriteKey || null,
        gifKey: data.gifKey || null,
        ...(data.assetBytes ? { assetBytes: Number(data.assetBytes) } : {}),
        ...(data.durationSec ? { durationSec: Number(data.durationSec) } : {}),
        ...(subsPatch ? { subtitles: subsPatch } : {}),
        ...(chaptersPatch ? { chapters: chaptersPatch } : {}),
        ...invalidateSummary,
      }
    }

    await payload.update({ collection: 'videos', id: video.id, data: patch as any, overrideAccess: true, depth: 0 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e, 'Не удалось обновить видео') }, { status: 500 })
  }
}
