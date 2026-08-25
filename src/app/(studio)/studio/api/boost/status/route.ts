import { withAuthor, apiError, authorCan } from '@/app/(studio)/studio/api/_lib'
import { NextResponse } from 'next/server'
import { loadBoostConfig, boostReady, queueCounts, estimate, activeRunForTenant, getDeposit, reconcile } from '@/lib/boost'
import { getPreset } from '@/lib/timeweb'

/**
 * Статус boost для студии (автор/владелец): доступность, депозит, очередь,
 * ИТОГОВАЯ оценка стоимости (маржа уже внутри — клиенту не показываем ни маржу,
 * ни пресет/цену аренды). Инфра-конфиг живёт в Payload-админке (суперадмин).
 * Оппортунистически двигает машину состояний (reconcile).
 */
export const GET = withAuthor(async ({ payload, tenantId, author }) => {
  if (!authorCan(author, 'tiers', 'manage')) return apiError('Недостаточно прав', 403)

  try { await reconcile(payload) } catch { /* best-effort */ }

  const cfg = await loadBoostConfig(payload)
  const ready = boostReady(cfg)
  const [counts, deposit, run] = await Promise.all([
    queueCounts(payload),
    getDeposit(payload, tenantId),
    activeRunForTenant(payload, tenantId),
  ])

  let preset = null
  try { preset = ready.ok ? await getPreset(cfg.presetId) : null } catch { /* сеть/ключ */ }
  const est = estimate(counts.queued || counts.busy, preset, cfg)

  return NextResponse.json({
    available: ready.ok,
    deposit,
    queue: counts,
    // Только итоговая цена и срок — без маржи, цены аренды и пресета.
    estimate: { hours: est.hours, rub: est.rub },
    activeRun: run
      ? { id: run.id, status: run.status, estRub: run.est_rub, createdAt: run.created_at, error: run.error }
      : null,
  })
})
