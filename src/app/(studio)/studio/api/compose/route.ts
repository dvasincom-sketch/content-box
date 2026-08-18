import { withAuthor, readJson, apiError, apiOk, findTenantSettings } from '../_lib'
import type { Payload } from 'payload'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rateLimit'
import { composePageBlocks, chunkComposeText, pingCompose, type ComposeMsg, type RawBlock } from '@/lib/asyaCompose'
import { sanitizeComposeBlocks } from '@/lib/composeBlocks'
import { logAiUsage, estimateTokens } from '@/lib/logAiUsage'
import { costRub } from '@/lib/aiPricing'

/**
 * AI-конструктор страницы: сплошной текст → блоки. Только для автора студии.
 * Дёргает Асю (capability compose) сервер-к-серверу и строго санитайзит ответ.
 *  POST { text, messages?, blocks? } → { ok, note, blocks }
 */
export const runtime = 'nodejs'
export const maxDuration = 120

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

  const rl = rateLimit(`compose:${clientIp(req.headers)}`, 40, 60_000)
  if (!rl.ok) return tooManyRequests(rl.retryAfter, 'Слишком часто. Подождите немного.')

  const data = await readJson<{ text?: string; messages?: ComposeMsg[]; blocks?: RawBlock[]; existing?: { type: string; title: string }[]; part?: { i?: number } }>(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const text = String(data.text || '').trim()
  if (text.length < 30) return apiError('Нужен текст не короче 30 символов')

  const messages: ComposeMsg[] = (Array.isArray(data.messages) ? data.messages : [])
    .filter((m) => m && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 4000) }))
  const prev = Array.isArray(data.blocks) ? data.blocks.slice(0, 40) : []
  const existing = Array.isArray(data.existing) ? data.existing.slice(0, 40) : []

  // Потоковый разбор по частям: клиент шлёт part.i, сервер сам режет текст и
  // обрабатывает один фрагмент за запрос (быстрый ответ, без долгого соединения).
  if (data.part && Number.isInteger(data.part.i)) {
    const MAX_CHARS = 120_000, MAX_PARTS = 16
    const chunks = chunkComposeText(text.slice(0, MAX_CHARS), 8000)
    const nParts = Math.min(chunks.length, MAX_PARTS)
    const i = Math.max(0, Math.min(Number(data.part.i), nParts - 1))
    const frag = chunks[i]
    try {
      const r = await composePageBlocks({ text: frag, part: { i, n: nParts }, existing: i === 0 ? existing : [], lang: 'ru', key })
      const blocks = sanitizeComposeBlocks(r.blocks)
      const tokensIn = estimateTokens(frag)
      const tokensOut = estimateTokens(r.note, JSON.stringify(r.blocks))
      void logAiUsage(payload, {
        tenant: tenantId, surface: 'compose', action: 'compose',
        tokensIn, tokensOut, actorType: 'author', meta: `часть ${i + 1}/${nParts}, ${blocks.length} блоков`,
      })
      return apiOk({
        note: r.note, blocks, suggest: i === 0 ? (r.suggest ?? null) : null,
        parts: nParts, part: i, truncated: chunks.length > MAX_PARTS || text.length > MAX_CHARS,
        tokensIn, tokensOut, costRub: costRub(tokensIn, tokensOut),
      })
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      return apiError('Не удалось разобрать текст: ' + reason, 502)
    }
  }

  try {
    const r = await composePageBlocks({ text: text.slice(0, 60000), messages, blocks: prev, existing, lang: 'ru', key })
    const blocks = sanitizeComposeBlocks(r.blocks)
    const tokensIn = estimateTokens(text, ...messages.map((m) => m.content))
    const tokensOut = estimateTokens(r.note, JSON.stringify(r.blocks))
    void logAiUsage(payload, {
      tenant: tenantId,
      surface: 'compose',
      action: 'compose',
      tokensIn,
      tokensOut,
      actorType: 'author',
      meta: `${blocks.length} блоков`,
    })
    return apiOk({ note: r.note, blocks, suggest: r.suggest ?? null, tokensIn, tokensOut, costRub: costRub(tokensIn, tokensOut) })
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return apiError('Не удалось разобрать текст: ' + reason, 502)
  }
})

/**
 * Диагностика подключения: доступна только автору студии. Возвращает лишь
 * факт наличия ключа Аси, сам ключ никогда не раскрывается.
 *  GET → { ok, enabled }
 */
export const GET = withAuthor(async ({ payload, tenantId }) => {
  let tenantKeyLen = 0
  try {
    const s = await findTenantSettings(payload, tenantId)
    tenantKeyLen = String((s as { aiComposeKey?: unknown } | null)?.aiComposeKey || '').trim().length
  } catch { /* ignore */ }
  // Сравниваем с рабочим ключом саммари: если summary=true, а compose=false —
  // проблема именно в переменной ASYA_COMPOSE_KEY (имя/область/не применилась),
  // а не в рантайм-инъекции env вообще. Значения ключей НЕ раскрываются.
  const composeKeyLen = (process.env.ASYA_COMPOSE_KEY || '').trim().length
  const summaryKeyLen = (process.env.ASYA_SUMMARY_KEY || '').trim().length
  let composeUrlHost = ''
  try {
    const base = (process.env.ASYA_SUMMARY_URL || 'https://xn--80a8a2b.online/api/summary').replace(/\/summary\/?$/, '')
    composeUrlHost = new URL(process.env.ASYA_COMPOSE_URL || `${base}/compose`).host
  } catch { /* ignore */ }
  const upstream = await pingCompose()
  return apiOk({
    enabled: tenantKeyLen > 0 || composeKeyLen > 0,
    upstreamReachable: upstream.reachable,
    upstreamStatus: upstream.status,
    keySource: tenantKeyLen > 0 ? 'studio' : composeKeyLen > 0 ? 'env' : 'none',
    hasStudioKey: tenantKeyLen > 0,
    hasComposeKey: composeKeyLen > 0,
    composeKeyLen,
    hasSummaryKey: summaryKeyLen > 0,
    composeUrlOverridden: !!process.env.ASYA_COMPOSE_URL,
    composeUrlHost,
    // Имена (НЕ значения) env-переменных, похожих на ключи Аси — чтобы поймать
    // опечатку/кириллицу в имени. ascii:false → в имени неотличимый на глаз
    // не-латинский символ (частая причина «переменная есть, но не видна»).
    asyaEnvKeys: Object.keys(process.env)
      .filter((k) => /asya|compose|summary/i.test(k))
      .map((k) => ({ name: k, ascii: /^[\x20-\x7E]+$/.test(k) })),
  })
})
