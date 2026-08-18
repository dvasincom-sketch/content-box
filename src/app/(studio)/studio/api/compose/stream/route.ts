import { withAuthor, apiError, findTenantSettings } from '../../_lib'
import type { Payload } from 'payload'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rateLimit'
import { composePageBlocks, chunkComposeText } from '@/lib/asyaCompose'
import { sanitizeComposeBlocks } from '@/lib/composeBlocks'
import { logAiUsage, estimateTokens } from '@/lib/logAiUsage'
import { costRub } from '@/lib/aiPricing'
import type { PBlock } from '@/lib/profileBlocks'

/**
 * Потоковый AI-конструктор: длинный текст → блоки, по частям, с прогрессом.
 *
 * В отличие от POST /studio/api/compose (один запрос — один ответ), здесь мы САМИ
 * режем текст на фрагменты и дёргаем Асю по одному фрагменту, отдавая события
 * server-sent events по мере готовности каждой части. Это снимает две проблемы
 * длинных текстов: (1) прежний код обрезал всё после 60k и не показывал прогресс;
 * (2) один длинный запрос упирался в таймаут прокси. Каждый вызов Аси короткий,
 * а поток держит соединение живым (данные идут после каждой части).
 *
 * Протокол SSE:
 *   event: start    data: { parts }
 *   event: progress data: { i, n, blocks, note }   — на каждый готовый фрагмент
 *   event: done     data: { note, suggest, blocks, parts, truncated, tokensIn, tokensOut, costRub }
 *   event: error    data: { error }
 */
export const runtime = 'nodejs'
export const maxDuration = 300

/** Максимум символов и фрагментов — потолок стоимости/времени одного разбора. */
const MAX_CHARS = 120_000
const MAX_PARTS = 16
const MAX_BLOCKS = 60

/** Ключ Аси для тенанта: сначала из студии (site-settings.aiComposeKey), затем платформенный env. */
async function tenantComposeKey(payload: Payload, tenantId: number): Promise<string> {
  try {
    const s = await findTenantSettings(payload, tenantId)
    const k = String((s as { aiComposeKey?: unknown } | null)?.aiComposeKey || '').trim()
    if (k) return k
  } catch { /* ignore */ }
  return (process.env.ASYA_COMPOSE_KEY || '').trim()
}

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const key = await tenantComposeKey(payload, tenantId)
  if (!key) return apiError('AI-конструктор не подключён', 503)

  const rl = rateLimit(`compose:${clientIp(req.headers)}`, 20, 60_000)
  if (!rl.ok) return tooManyRequests(rl.retryAfter, 'Слишком часто. Подождите немного.')

  let data: { text?: string; existing?: { type: string; title: string }[] } | undefined
  try { data = await req.json() } catch { data = undefined }
  if (data === undefined) return apiError('Некорректный запрос')

  const text = String(data.text || '').trim()
  if (text.length < 30) return apiError('Нужен текст не короче 30 символов')
  const existing = Array.isArray(data.existing) ? data.existing.slice(0, 40) : []

  let chunks = chunkComposeText(text.slice(0, MAX_CHARS), 8000)
  const truncated = chunks.length > MAX_PARTS || text.length > MAX_CHARS
  if (chunks.length > MAX_PARTS) chunks = chunks.slice(0, MAX_PARTS)

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, obj: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(obj)}\n\n`))
      }
      try {
        send('start', { parts: chunks.length })
        const all: PBlock[] = []
        let note = ''
        let suggest: { title?: string; tags?: string[] } | null = null

        for (let i = 0; i < chunks.length; i++) {
          const r = await composePageBlocks({
            text: chunks[i],
            part: { i, n: chunks.length },
            existing: i === 0 ? existing : [],
            lang: 'ru',
            key,
          })
          const clean = sanitizeComposeBlocks(r.blocks)
          if (i === 0) { note = r.note; suggest = r.suggest }
          for (const b of clean) { if (all.length < MAX_BLOCKS) all.push(b) }
          send('progress', { i, n: chunks.length, blocks: clean, note: r.note })
          if (all.length >= MAX_BLOCKS) break
        }

        const tokensIn = estimateTokens(text)
        const tokensOut = estimateTokens(note, JSON.stringify(all))
        void logAiUsage(payload, {
          tenant: tenantId,
          surface: 'compose',
          action: 'compose',
          tokensIn,
          tokensOut,
          actorType: 'author',
          meta: `${all.length} блоков, ${chunks.length} частей`,
        })
        send('done', {
          note: note || `Разобрал текст на ${all.length} блоков (в ${chunks.length} частях).`,
          suggest,
          blocks: all,
          parts: chunks.length,
          truncated,
          tokensIn,
          tokensOut,
          costRub: costRub(tokensIn, tokensOut),
        })
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e)
        send('error', { error: 'Не удалось разобрать текст: ' + reason })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
})
