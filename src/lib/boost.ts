/**
 * Оркестрация boost-транскодинга (Ф0) — аренда мощного сервера Timeweb под прогон
 * очереди video_jobs. Только сервер.
 *
 * Модель Ф0: платформа арендует сервер, он дренирует ГЛОБАЛЬНУЮ очередь video_jobs
 * (воркер не фильтрует по тенанту), инициатор кнопки — тенант — платит из своего
 * депозита. Для честного пер-тенантного биллинга нужен флаг boost на задаче (Ф1).
 *
 * Жизненный цикл в таблице boost_runs:
 *   provisioning → active → draining(idle) → deleting → done | failed
 * Тик (reconcile) двигает состояние и гасит сервер; watchdog по max-lifetime
 * защищает от утечки денег.
 */
import type { Payload } from 'payload'
import { sqlRows } from '@/lib/sql'
import {
  timewebToken,
  listPresets,
  getPreset,
  createServer,
  getServer,
  deleteServer,
  isServerReady,
  type TwPreset,
} from '@/lib/timeweb'

export type BoostConfig = {
  enabled: boolean
  presetId: string
  imageId: string
  osId: number | null
  location: string | null
  maxLifetimeMin: number
  marginPct: number
  idleMinutes: number
  throughputPerHour: number
  cpusPerWorker: number
  replicasOverride: number | null
  whisperEnabled: boolean
}

/** Сырая строка boost_config (id=1). Все поля опциональны (могут быть null). */
export type BoostConfigRow = {
  enabled: boolean | null
  preset_id: string | null
  image_id: string | null
  os_id: number | null
  location: string | null
  replicas: number | null
  cpus_per_worker: number | null
  margin_pct: number | null
  max_lifetime_min: number | null
  idle_minutes: number | null
  throughput_per_hour: number | null
  whisper_enabled: boolean | null
}

/** Прочитать конфиг из коллекции boost-settings (первая строка). null, если
 *  таблицы/строки ещё нет — тогда работаем на env-дефолтах. */
export async function getBoostConfigRow(payload: Payload): Promise<BoostConfigRow | null> {
  try {
    const rows = await sqlRows<BoostConfigRow>(payload, `SELECT * FROM boost_settings ORDER BY id ASC LIMIT 1`)
    return rows[0] || null
  } catch {
    return null
  }
}

/**
 * Итоговый конфиг: значения из boost_config (редактируются в студии без редеплоя)
 * поверх env-дефолтов. Токен — всегда из env (секрет).
 */
export async function loadBoostConfig(payload: Payload): Promise<BoostConfig> {
  const row = await getBoostConfigRow(payload)
  const s = (db: unknown, env: string | undefined): string => {
    const dv = db == null ? '' : String(db)
    return dv || env || ''
  }
  const n = (db: unknown, env: string | undefined, dflt: number): number => {
    if (db != null && Number.isFinite(Number(db))) return Number(db)
    if (env != null && env !== '' && Number.isFinite(Number(env))) return Number(env)
    return dflt
  }
  return {
    enabled: row?.enabled != null ? Boolean(row.enabled) : (process.env.BOOST_ENABLED || '0') !== '0',
    presetId: s(row?.preset_id, process.env.BOOST_PRESET_ID),
    imageId: s(row?.image_id, process.env.BOOST_IMAGE_ID),
    osId: row?.os_id != null ? Number(row.os_id) : intOrNull(process.env.BOOST_OS_ID),
    location: s(row?.location, process.env.BOOST_LOCATION) || null,
    maxLifetimeMin: n(row?.max_lifetime_min, process.env.BOOST_MAX_LIFETIME_MIN, 180),
    marginPct: n(row?.margin_pct, process.env.BOOST_MARGIN_PCT, 30),
    idleMinutes: n(row?.idle_minutes, process.env.BOOST_IDLE_MINUTES, 10),
    throughputPerHour: n(row?.throughput_per_hour, process.env.BOOST_THROUGHPUT_PER_HOUR, 20),
    cpusPerWorker: n(row?.cpus_per_worker, process.env.BOOST_CPUS_PER_WORKER, 7),
    replicasOverride: row?.replicas != null ? Number(row.replicas) : intOrNull(process.env.BOOST_REPLICAS),
    whisperEnabled: row?.whisper_enabled != null ? Boolean(row.whisper_enabled) : (process.env.BOOST_WHISPER_ENABLED || '1') !== '0',
  }
}

// Конфиг правится суперадмином в Payload-админке (коллекция boost-settings) —
// студийного сохранения больше нет.

/** Готов ли boost к запуску (токен из env + вкл + пресет + образ). */
export function boostReady(cfg: BoostConfig): { ok: boolean; reason?: string } {
  if (!timewebToken()) return { ok: false, reason: 'TIMEWEB_TOKEN не задан (env)' }
  if (!cfg.enabled) return { ok: false, reason: 'Boost выключен в настройках' }
  if (!cfg.presetId) return { ok: false, reason: 'Не выбран пресет (BOOST_PRESET_ID)' }
  if (!cfg.imageId && cfg.osId == null) return { ok: false, reason: 'Не задан образ воркера (BOOST_IMAGE_ID)' }
  return { ok: true }
}

export type BoostRun = {
  id: number
  tenant_id: number | null
  timeweb_server_id: string | null
  preset_id: string | null
  server_ip: string | null
  replicas: number | null
  status: string
  est_rub: number | null
  actual_rub: number | null
  hours_billed: number | null
  price_per_hour: number | null
  last_nonempty_at: string | null
  active_at: string | null
  deleted_at: string | null
  error: string | null
  created_at: string
  updated_at: string
}

const TERMINAL = new Set(['done', 'failed'])

/** Активный (не завершённый) прогон тенанта, если есть. */
export async function activeRunForTenant(payload: Payload, tenantId: number): Promise<BoostRun | null> {
  const rows = await sqlRows<BoostRun>(
    payload,
    `SELECT * FROM boost_runs WHERE tenant_id = $1 AND status NOT IN ('done','failed') ORDER BY id DESC LIMIT 1`,
    [tenantId],
  )
  return rows[0] || null
}

/** Любой активный прогон (глобально) — Ф0 допускает один сервер за раз. */
export async function anyActiveRun(payload: Payload): Promise<BoostRun | null> {
  const rows = await sqlRows<BoostRun>(
    payload,
    `SELECT * FROM boost_runs WHERE status NOT IN ('done','failed') ORDER BY id DESC LIMIT 1`,
  )
  return rows[0] || null
}

/** Счётчики очереди (глобально): queued + реально обрабатываемые. */
export async function queueCounts(payload: Payload): Promise<{ queued: number; processing: number; busy: number }> {
  const rows = await sqlRows<{ queued: number; processing: number }>(
    payload,
    `SELECT
       count(*) FILTER (WHERE status='queued')::int AS queued,
       count(*) FILTER (WHERE status='processing')::int AS processing
     FROM video_jobs`,
  )
  const queued = Number(rows[0]?.queued || 0)
  const processing = Number(rows[0]?.processing || 0)
  return { queued, processing, busy: queued + processing }
}

/** Оценка стоимости прогона очереди на пресете. */
export function estimate(
  pending: number,
  preset: TwPreset | null,
  cfg: BoostConfig,
): { hours: number; rub: number | null; pricePerHour: number | null } {
  const hours = Math.max(1, Math.ceil(pending / Math.max(1, cfg.throughputPerHour)))
  const pph = preset?.pricePerHour ?? null
  if (pph == null) return { hours, rub: null, pricePerHour: null }
  const rub = Math.round(hours * pph * (1 + cfg.marginPct / 100))
  return { hours, rub, pricePerHour: pph }
}

/** Сколько реплик воркера поднимать на пресете. */
export function replicasFor(preset: TwPreset | null, cfg: BoostConfig): number {
  if (cfg.replicasOverride && cfg.replicasOverride > 0) return cfg.replicasOverride
  const cpu = preset?.cpu || 0
  return Math.max(1, Math.floor(cpu / Math.max(1, cfg.cpusPerWorker)) || 1)
}

/**
 * cloud-init (user-data): пишет .env воркера и поднимает N реплик из образа.
 * Образ ДОЛЖЕН содержать транскодер-репо в /opt/transcoder с docker-compose,
 * читающим /opt/transcoder/.env (контракт образа — см. burst-repo).
 * Креды передаём из ENV самого приложения (тот же DATABASE_URL/S3/webhook).
 */
export function cloudInit(cfg: BoostConfig, replicas: number, encodeThreads: number): string {
  const env: Record<string, string> = {
    DATABASE_URL: process.env.DATABASE_URL || process.env.DATABASE_URI || '',
    S3_ENDPOINT: process.env.S3_ENDPOINT || process.env.R2_ENDPOINT || '',
    S3_REGION: process.env.S3_REGION || 'ru-1',
    S3_BUCKET: process.env.S3_BUCKET || process.env.R2_BUCKET || '',
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '',
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '',
    VIDEO_WEBHOOK_SECRET: process.env.VIDEO_WEBHOOK_SECRET || '',
    APP_INTERNAL_URL: process.env.BOOST_APP_URL || process.env.APP_PUBLIC_URL || '',
    ENCODE_THREADS: String(encodeThreads),
    WHISPER_THREADS: String(encodeThreads),
    WHISPER_ENABLED: cfg.whisperEnabled ? '1' : '0',
  }
  const envLines = Object.entries(env)
    .map(([k, v]) => `${k}=${String(v).replace(/\n/g, ' ')}`)
    .join('\n')
  // Осторожно с heredoc: значения секретов не логируем.
  return [
    '#!/bin/bash',
    'set -e',
    'cd /opt/transcoder',
    "cat > .env <<'EOF_ENV'",
    envLines,
    'EOF_ENV',
    `docker compose up -d --scale worker=${replicas} || docker-compose up -d --scale worker=${replicas}`,
  ].join('\n')
}

/**
 * Запустить boost: гейт (готовность, баланс депозита, нет активного прогона) →
 * создать сервер → строка boost_runs (provisioning).
 */
export async function startBoost(
  payload: Payload,
  tenantId: number,
): Promise<{ ok: true; run: BoostRun } | { ok: false; error: string }> {
  const cfg = await loadBoostConfig(payload)
  const ready = boostReady(cfg)
  if (!ready.ok) return { ok: false, error: ready.reason || 'boost не сконфигурирован' }

  const existing = await anyActiveRun(payload)
  if (existing) return { ok: false, error: 'Boost-сервер уже запущен — дождитесь завершения.' }

  const { queued, busy } = await queueCounts(payload)
  if (busy === 0) return { ok: false, error: 'Очередь пуста — ускорять нечего.' }

  const preset = await getPreset(cfg.presetId).catch(() => null)
  const est = estimate(queued || busy, preset, cfg)

  // Депозит тенанта должен покрывать оценку (если цена известна).
  const deposit = await getDeposit(payload, tenantId)
  if (est.rub != null && deposit < est.rub) {
    return { ok: false, error: `Недостаточно средств на boost-депозите: нужно ≈ ${est.rub} ₽, на счету ${Math.round(deposit)} ₽.` }
  }

  const replicas = replicasFor(preset, cfg)
  const encodeThreads = cfg.cpusPerWorker
  const name = `boost-${tenantId}-${Date.now().toString(36)}`

  let server
  try {
    server = await createServer({
      name,
      presetId: cfg.presetId,
      imageId: cfg.imageId || undefined,
      osId: cfg.osId ?? undefined,
      comment: `boost transcoder tenant=${tenantId}`,
      cloudInit: cloudInit(cfg, replicas, encodeThreads),
    })
  } catch (e: any) {
    return { ok: false, error: `Не удалось создать сервер: ${e?.message || e}` }
  }

  const rows = await sqlRows<BoostRun>(
    payload,
    `INSERT INTO boost_runs (tenant_id, timeweb_server_id, preset_id, server_ip, replicas, status, est_rub, price_per_hour, last_nonempty_at)
     VALUES ($1,$2,$3,$4,$5,'provisioning',$6,$7, now())
     RETURNING *`,
    [tenantId, server.id, cfg.presetId, server.ip, replicas, est.rub ?? 0, est.pricePerHour ?? 0],
  )
  return { ok: true, run: rows[0] }
}

/** Депозит тенанта (₽) из site-settings. */
export async function getDeposit(payload: Payload, tenantId: number): Promise<number> {
  const res = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const s: any = res.docs[0]
  return Number(s?.boostDepositRub || 0)
}

async function deductDeposit(payload: Payload, tenantId: number, amountRub: number): Promise<void> {
  const res = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const s: any = res.docs[0]
  if (!s) return
  const next = Math.max(0, Number(s.boostDepositRub || 0) - Math.max(0, amountRub))
  await payload.update({ collection: 'site-settings', id: s.id, data: { boostDepositRub: next } as any, overrideAccess: true })
}

/**
 * Продвинуть все активные прогоны: статус сервера, простой очереди (idle → гасим),
 * watchdog по max-lifetime. Вызывается тиком (/api/boost/tick) и оппортунистически
 * из студийного status.
 */
export async function reconcile(payload: Payload): Promise<{ advanced: number }> {
  const runs = await sqlRows<BoostRun>(payload, `SELECT * FROM boost_runs WHERE status NOT IN ('done','failed') ORDER BY id ASC`)
  if (runs.length === 0) return { advanced: 0 }
  const cfg = await loadBoostConfig(payload)
  const { busy } = await queueCounts(payload)
  let advanced = 0

  for (const run of runs) {
    try {
      // Watchdog: жёсткий предел жизни — гасим независимо ни от чего.
      const ageMin = (Date.now() - new Date(run.created_at).getTime()) / 60000
      if (ageMin > cfg.maxLifetimeMin) {
        await finalize(payload, run, cfg, 'Достигнут лимит жизни boost-сервера — принудительное завершение.')
        advanced++
        continue
      }

      if (run.status === 'provisioning' || run.status === 'active') {
        // Обновляем статус сервера/IP.
        let srv = null
        try { srv = run.timeweb_server_id ? await getServer(run.timeweb_server_id) : null } catch { /* сеть — попробуем позже */ }
        if (srv && run.status === 'provisioning' && isServerReady(srv)) {
          await setRun(payload, run.id, { status: 'active', active_at: 'now()', server_ip: srv.ip })
          advanced++
        }
        // Простой очереди: пока busy>0 — двигаем last_nonempty_at; когда 0 достаточно долго — гасим.
        if (busy > 0) {
          await setRun(payload, run.id, { last_nonempty_at: 'now()' })
        } else {
          const idleMin = run.last_nonempty_at ? (Date.now() - new Date(run.last_nonempty_at).getTime()) / 60000 : 0
          // Гасим только уже активный сервер (не в момент провижининга), чтобы не срезать старт.
          const started = run.status === 'active' || run.active_at
          if (started && idleMin >= cfg.idleMinutes) {
            await finalize(payload, run, cfg, null)
            advanced++
          }
        }
      }
    } catch (e: any) {
      // Ошибка одного прогона не должна ронять тик.
      await setRun(payload, run.id, { error: String(e?.message || e).slice(0, 500) }).catch(() => {})
    }
  }
  return { advanced }
}

/** Завершить прогон: удалить сервер, посчитать стоимость, списать депозит. */
export async function finalize(payload: Payload, run: BoostRun, cfg: BoostConfig, error: string | null): Promise<void> {
  await setRun(payload, run.id, { status: 'deleting' })
  if (run.timeweb_server_id) {
    try { await deleteServer(run.timeweb_server_id) } catch { /* повторим на следующем тике через watchdog */ }
  }
  const createdMs = new Date(run.created_at).getTime()
  const hours = Math.max(1, Math.ceil((Date.now() - createdMs) / 3600000))
  const pph = Number(run.price_per_hour || 0)
  const actual = Math.round(hours * pph * (1 + cfg.marginPct / 100))
  if (run.tenant_id && actual > 0) {
    try { await deductDeposit(payload, run.tenant_id, actual) } catch { /* биллинг не должен блокировать завершение */ }
  }
  await sqlRows(
    payload,
    `UPDATE boost_runs SET status=$2, deleted_at=now(), hours_billed=$3, actual_rub=$4, error=COALESCE($5, error), updated_at=now() WHERE id=$1`,
    [run.id, error ? 'failed' : 'done', hours, actual, error],
  )
}

/** Ручная остановка прогона (кнопка «Остановить»). */
export async function stopBoost(payload: Payload, tenantId: number): Promise<{ ok: boolean; error?: string }> {
  const run = await activeRunForTenant(payload, tenantId)
  if (!run) return { ok: false, error: 'Активного boost-прогона нет.' }
  await finalize(payload, run, await loadBoostConfig(payload), null)
  return { ok: true }
}

/** Частичный апдейт boost_runs; значения 'now()' подставляются как SQL now(). */
async function setRun(payload: Payload, id: number, patch: Record<string, unknown>): Promise<void> {
  const sets: string[] = []
  const params: unknown[] = [id]
  for (const [k, v] of Object.entries(patch)) {
    if (v === 'now()') {
      sets.push(`"${k}" = now()`)
    } else {
      params.push(v)
      sets.push(`"${k}" = $${params.length}`)
    }
  }
  if (sets.length === 0) return
  await sqlRows(payload, `UPDATE boost_runs SET ${sets.join(', ')}, updated_at=now() WHERE id=$1`, params)
}

function intOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) ? n : null
}

export { listPresets }
