import { withAuthor, apiError, authorCan } from '@/app/(studio)/studio/api/_lib'
import { NextResponse } from 'next/server'
import { boostConfig, boostReady, queueCounts, estimate, activeRunForTenant, getDeposit, reconcile } from '@/lib/boost'
import { getPreset } from '@/lib/timeweb'

/**
 * Статус boost для студии (owner/финансовое право): готовность конфига, депозит,
 * очередь, оценка, активный прогон. Оппортунистически двигает машину состояний
 * (reconcile) — чтобы простое открытие панели гасило простаивающий сервер.
 */
export const GET = withAuthor(async ({ payload, tenantId, author }) => {
  if (!authorCan(author, 'tiers', 'manage')) return apiError('Недостаточно прав', 403)

  // Best-effort: не роняем статус, если тик упал.
  try { await reconcile(payload) } catch { /* игнор */ }

  const cfg = boostConfig()
  const ready = boostReady(cfg)
  const [counts, deposit, run] = await Promise.all([
    queueCounts(payload),
    getDeposit(payload, tenantId),
    activeRunForTenant(payload, tenantId),
  ])

  let preset = null
  try { preset = ready.ok ? await getPreset(cfg.presetId) : null } catch { /* сеть/ключ — покажем без пресета */ }
  const est = estimate(counts.queued || counts.busy, preset, cfg)

  return NextResponse.json({
    ready: ready.ok,
    reason: ready.ok ? null : ready.reason,
    deposit,
    queue: counts,
    estimate: est,
    marginPct: cfg.marginPct,
    idleMinutes: cfg.idleMinutes,
    maxLifetimeMin: cfg.maxLifetimeMin,
    preset: preset ? { id: preset.id, cpu: preset.cpu, ramMb: preset.ramMb, pricePerHour: preset.pricePerHour, location: preset.location } : null,
    activeRun: run
      ? {
          id: run.id,
          status: run.status,
          serverIp: run.server_ip,
          estRub: run.est_rub,
          actualRub: run.actual_rub,
          pricePerHour: run.price_per_hour,
          replicas: run.replicas,
          createdAt: run.created_at,
          activeAt: run.active_at,
          error: run.error,
        }
      : null,
  })
})
