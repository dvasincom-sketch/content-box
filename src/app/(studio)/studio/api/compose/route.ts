import { withAuthor, readJson, apiError, apiOk } from '../_lib'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rateLimit'
import { composeEnabled, composePageBlocks, type ComposeMsg, type RawBlock } from '@/lib/asyaCompose'
import { sanitizeComposeBlocks } from '@/lib/composeBlocks'
import { logAiUsage, estimateTokens } from '@/lib/logAiUsage'

/**
 * AI-конструктор страницы: сплошной текст → блоки. Только для автора студии.
 * Дёргает Асю (capability compose) сервер-к-серверу и строго санитайзит ответ.
 *  POST { text, messages?, blocks? } → { ok, note, blocks }
 */
export const runtime = 'nodejs'

export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  if (!composeEnabled()) return apiError('AI-конструктор не подключён', 503)

  const rl = rateLimit(`compose:${clientIp(req.headers)}`, 20, 60_000)
  if (!rl.ok) return tooManyRequests(rl.retryAfter, 'Слишком часто. Подождите немного.')

  const data = await readJson<{ text?: string; messages?: ComposeMsg[]; blocks?: RawBlock[] }>(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const text = String(data.text || '').trim()
  if (text.length < 30) return apiError('Нужен текст не короче 30 символов')

  const messages: ComposeMsg[] = (Array.isArray(data.messages) ? data.messages : [])
    .filter((m) => m && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 4000) }))
  const prev = Array.isArray(data.blocks) ? data.blocks.slice(0, 40) : []

  try {
    const r = await composePageBlocks({ text: text.slice(0, 24000), messages, blocks: prev, lang: 'ru' })
    const blocks = sanitizeComposeBlocks(r.blocks)
    void logAiUsage(payload, {
      tenant: tenantId,
      surface: 'compose',
      action: 'compose',
      tokensIn: estimateTokens(text, ...messages.map((m) => m.content)),
      tokensOut: estimateTokens(r.note, JSON.stringify(r.blocks)),
      actorType: 'author',
      meta: `${blocks.length} блоков`,
    })
    return apiOk({ note: r.note, blocks })
  } catch {
    return apiError('Не удалось разобрать текст. Попробуйте ещё раз.', 502)
  }
})
