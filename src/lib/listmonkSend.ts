/**
 * Отправка дайджеста через Listmonk как КАМПАНИЯ (regular), чтобы получить
 * трекинг открытий/кликов и историю выпусков (её читает getTenantDigests по
 * тегу `tenant:<id>`). Работает только при заданных LISTMONK_API_*; всё обёрнуто
 * в try/catch и возвращает false при любой осечке — вызывающий тогда падает на
 * прежнюю отправку через Rusender, так что дайджест не теряется.
 *
 * Кампания — ОДНО письмо на всех подписчиков тенанта (персонализация по
 * подпискам на книги в этом пути не применяется — это плата за трекинг).
 * Отписка — штатная Listmonk через тег {{ UnsubscribeURL }} в теле.
 */
const BASE = (process.env.LISTMONK_API_URL || '').replace(/\/$/, '')
const USER = (process.env.LISTMONK_API_USER || '').trim()
const TOKEN = (process.env.LISTMONK_API_TOKEN || '').trim()
const FROM_EMAIL = (process.env.LISTMONK_FROM_EMAIL || 'noreply@contentbox.site').trim()

export function listmonkSendEnabled(): boolean {
  return Boolean(BASE && USER && TOKEN)
}

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${USER}:${TOKEN}`).toString('base64')
}

async function api(path: string, method = 'GET', body?: unknown): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
}

/** Список Listmonk для тенанта (по тегу tenant:<id>), создаём при отсутствии. */
async function ensureList(tenantId: string | number, tenantName: string): Promise<number | null> {
  const tag = `tenant:${tenantId}`
  const r = await api('/api/lists?per_page=1000')
  if (r.ok) {
    const j = (await r.json()) as { data?: { results?: Array<{ id: number; tags?: string[] }> } }
    const found = (j?.data?.results ?? []).find((l) => Array.isArray(l.tags) && l.tags.includes(tag))
    if (found) return found.id
  }
  const c = await api('/api/lists', 'POST', {
    name: `Подписчики · ${tenantName}`.slice(0, 120),
    type: 'private',
    optin: 'single',
    tags: [tag],
  })
  if (!c.ok) return null
  const cj = (await c.json()) as { data?: { id?: number } }
  return cj?.data?.id ?? null
}

/** Upsert подписчиков в список. POST на существующий email вернёт 409 — игнорируем
 *  (он уже в списке с прошлого прогона); новые добавятся. */
async function addSubscribers(listId: number, subs: Array<{ email: string; name?: string }>): Promise<void> {
  for (const s of subs) {
    if (!s.email) continue
    try {
      await api('/api/subscribers', 'POST', {
        email: s.email,
        name: s.name || s.email,
        status: 'enabled',
        lists: [listId],
        preconfirm_subscriptions: true,
      })
    } catch {
      /* уже есть / временная ошибка — пропускаем */
    }
  }
}

async function createCampaign(
  listId: number,
  args: { tenantId: string | number; tenantName: string; subject: string; html: string },
): Promise<number | null> {
  const c = await api('/api/campaigns', 'POST', {
    name: `Дайджест · ${args.subject}`.slice(0, 150),
    subject: args.subject,
    lists: [listId],
    from_email: `${args.tenantName} <${FROM_EMAIL}>`,
    content_type: 'html',
    body: args.html,
    type: 'regular',
    tags: [`tenant:${args.tenantId}`],
    messenger: 'email',
  })
  if (!c.ok) return null
  const cj = (await c.json()) as { data?: { id?: number } }
  return cj?.data?.id ?? null
}

async function startCampaign(id: number): Promise<void> {
  await api(`/api/campaigns/${id}/status`, 'PUT', { status: 'running' })
}

export async function sendDigestCampaign(args: {
  tenantId: string | number
  tenantName: string
  subscribers: Array<{ email: string; name?: string }>
  subject: string
  html: string
}): Promise<boolean> {
  try {
    if (!listmonkSendEnabled() || args.subscribers.length === 0) return false
    const listId = await ensureList(args.tenantId, args.tenantName)
    if (listId == null) return false
    await addSubscribers(listId, args.subscribers)
    const campId = await createCampaign(listId, args)
    if (campId == null) return false
    await startCampaign(campId)
    return true
  } catch {
    return false
  }
}
