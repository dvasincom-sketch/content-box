/**
 * Клиент Timeweb Cloud API для boost-транскодинга (только сервер).
 *
 * Аккаунт — платформенный, токен из ENV `TIMEWEB_TOKEN` (мощный секрет: создаёт/
 * удаляет серверы, тратит деньги — НИКОГДА не отдаём на клиент).
 *
 * ⚠️ ФОРМЫ ЗАПРОСА/ОТВЕТА помечены как ASSUMPTION — свериться после ПЕРВОГО живого
 * вызова (см. https://timeweb.cloud/api-docs). Все обращения к полям ответа
 * централизованы здесь, чтобы правка была в одном месте.
 *
 * Подтверждённые эндпоинты (из туториалов Timeweb):
 *   GET    /api/v1/presets/servers        — тарифы (id, cpu, ram, disk, цена, локация)
 *   GET    /api/v1/account/finances       — баланс аккаунта
 *   POST   /api/v1/servers                — создать сервер
 *   GET    /api/v1/servers/{id}           — статус + сеть (IP)
 *   DELETE /api/v1/servers/{id}           — удалить
 */

const API_BASE = process.env.TIMEWEB_API_BASE || 'https://api.timeweb.cloud/api/v1'
const TIMEOUT_MS = Number(process.env.TIMEWEB_TIMEOUT_MS || 20000)

export function timewebToken(): string {
  return process.env.TIMEWEB_TOKEN || ''
}
export function timewebEnabled(): boolean {
  return Boolean(timewebToken()) && (process.env.BOOST_ENABLED || '0') !== '0'
}

export type TwPreset = {
  id: string
  cpu: number | null
  ramMb: number | null
  diskMb: number | null
  location: string | null
  pricePerHour: number | null
  priceMonth: number | null
  raw: any
}

export type TwServer = {
  id: string
  status: string // ASSUMPTION: 'installing' | 'on' | 'off' | ... — свериться
  ip: string | null
  raw: any
}

class TimewebError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function tw(method: string, path: string, body?: unknown): Promise<any> {
  const token = timewebToken()
  if (!token) throw new TimewebError('TIMEWEB_TOKEN не задан', 500)
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body != null ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      cache: 'no-store',
    })
    const text = await res.text()
    let json: any = null
    try { json = text ? JSON.parse(text) : null } catch { /* не JSON */ }
    if (!res.ok) {
      const msg = (json && (json.message || json.error || json.error_message)) || text || `HTTP ${res.status}`
      throw new TimewebError(String(msg).slice(0, 300), res.status)
    }
    return json
  } catch (e: any) {
    if (e instanceof TimewebError) throw e
    if (e?.name === 'AbortError') throw new TimewebError('Timeweb API: таймаут', 504)
    throw new TimewebError(`Timeweb API: ${e?.message || 'сетевая ошибка'}`, 502)
  } finally {
    clearTimeout(t)
  }
}

/** Список тарифов серверов. ASSUMPTION: ответ { server_presets: [...] } или { presets: [...] }. */
export async function listPresets(): Promise<TwPreset[]> {
  const j = await tw('GET', '/presets/servers')
  const arr: any[] = j?.server_presets || j?.presets || j?.presets_servers || (Array.isArray(j) ? j : [])
  return arr.map(normalizePreset)
}

/** Один тариф по id (из общего списка). */
export async function getPreset(presetId: string): Promise<TwPreset | null> {
  const all = await listPresets()
  return all.find((p) => String(p.id) === String(presetId)) || null
}

function normalizePreset(p: any): TwPreset {
  // ASSUMPTION: поля цены/ядер — свериться. price_per_hour может отсутствовать —
  // тогда считаем из месячной: месяц ≈ 720 ч.
  const priceMonth = numOrNull(p?.price ?? p?.price_month ?? p?.month_price)
  const pph = numOrNull(p?.price_per_hour ?? p?.hour_price ?? p?.price_hour)
  const pricePerHour = pph != null ? pph : priceMonth != null ? round2(priceMonth / 720) : null
  return {
    id: String(p?.id ?? ''),
    cpu: numOrNull(p?.cpu ?? p?.cpu_count ?? p?.vcpu),
    ramMb: numOrNull(p?.ram ?? p?.memory ?? p?.ram_mb),
    diskMb: numOrNull(p?.disk ?? p?.disk_mb ?? p?.nvme),
    location: (p?.location || p?.location_code || p?.availability_zone || null) as string | null,
    pricePerHour,
    priceMonth,
    raw: p,
  }
}

/** Баланс аккаунта, ₽. ASSUMPTION: { finances: { balance } } или { balance }. */
export async function getBalance(): Promise<number | null> {
  const j = await tw('GET', '/account/finances')
  const b = j?.finances?.balance ?? j?.balance ?? j?.finances?.total ?? null
  return numOrNull(b)
}

/**
 * Создать сервер. ASSUMPTION по телу — свериться после первого вызова.
 * `cloudInit` — user-data (bash/cloud-config), поднимает воркеры с env.
 */
export async function createServer(opts: {
  name: string
  presetId: string
  imageId?: string
  osId?: number
  bandwidth?: number
  comment?: string
  cloudInit?: string
}): Promise<TwServer> {
  const body: any = {
    name: opts.name,
    preset_id: numOrSelf(opts.presetId),
    bandwidth: opts.bandwidth ?? 1000,
    is_ddos_guard: false,
    is_local_network: false,
    comment: opts.comment || 'boost transcoder',
  }
  // Образ (снапшот воркера) ИЛИ ос. ASSUMPTION: поле image_id / os_id.
  if (opts.imageId) body.image_id = numOrSelf(opts.imageId)
  else if (opts.osId != null) body.os_id = opts.osId
  if (opts.cloudInit) body.cloud_init = opts.cloudInit
  const j = await tw('POST', '/servers', body)
  return normalizeServer(j?.server ?? j)
}

export async function getServer(serverId: string): Promise<TwServer> {
  const j = await tw('GET', `/servers/${encodeURIComponent(serverId)}`)
  return normalizeServer(j?.server ?? j)
}

export async function deleteServer(serverId: string): Promise<void> {
  await tw('DELETE', `/servers/${encodeURIComponent(serverId)}`)
}

/** Список серверов (для watchdog-сверки «сирот»). */
export async function listServers(): Promise<TwServer[]> {
  const j = await tw('GET', '/servers')
  const arr: any[] = j?.servers || (Array.isArray(j) ? j : [])
  return arr.map(normalizeServer)
}

function normalizeServer(s: any): TwServer {
  // IP: ASSUMPTION networks[].ips[] или main_ipv4. Берём первый публичный IPv4.
  let ip: string | null = s?.main_ipv4 || s?.ipv4 || null
  if (!ip && Array.isArray(s?.networks)) {
    for (const n of s.networks) {
      const cand = n?.ip || (Array.isArray(n?.ips) ? (n.ips[0]?.ip || n.ips[0]) : null)
      if (cand) { ip = String(cand); break }
    }
  }
  return { id: String(s?.id ?? ''), status: String(s?.status ?? 'unknown'), ip, raw: s }
}

/** Готов ли сервер (можно считать активным). ASSUMPTION по значениям статуса. */
export function isServerReady(s: TwServer): boolean {
  const st = s.status.toLowerCase()
  return st === 'on' || st === 'active' || st === 'started' || st === 'running'
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
/** preset_id/image_id могут быть числом — приводим, если это чистое число. */
function numOrSelf(v: string): number | string {
  const n = Number(v)
  return Number.isInteger(n) && String(n) === String(v) ? n : v
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
