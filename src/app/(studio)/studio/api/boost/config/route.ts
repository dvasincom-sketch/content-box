import { withAuthor, readJson, apiError, apiOk, authorCan } from '@/app/(studio)/studio/api/_lib'
import { saveBoostConfig, type BoostConfigRow } from '@/lib/boost'

/**
 * Сохранить параметры boost (пресет, реплики, потоки, маржа, лимиты, вкл/выкл,
 * образ) — редактируется в студийной панели без редеплоя. Токен здесь НЕ трогаем
 * (он в env). Owner/финансовое право.
 */
export const POST = withAuthor(async ({ req, payload, author }) => {
  if (!authorCan(author, 'tiers', 'manage')) return apiError('Недостаточно прав', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const patch: Partial<BoostConfigRow> = {}
  if ('enabled' in data) patch.enabled = Boolean(data.enabled)
  if ('whisperEnabled' in data) patch.whisper_enabled = Boolean(data.whisperEnabled)
  if ('presetId' in data) patch.preset_id = strOrNull(data.presetId)
  if ('imageId' in data) patch.image_id = strOrNull(data.imageId)
  if ('location' in data) patch.location = strOrNull(data.location)
  if ('osId' in data) patch.os_id = intOrNull(data.osId)
  if ('replicas' in data) patch.replicas = intOrNull(data.replicas)
  if ('cpusPerWorker' in data) patch.cpus_per_worker = intOrNull(data.cpusPerWorker)
  if ('marginPct' in data) patch.margin_pct = numOrNull(data.marginPct)
  if ('maxLifetimeMin' in data) patch.max_lifetime_min = intOrNull(data.maxLifetimeMin)
  if ('idleMinutes' in data) patch.idle_minutes = intOrNull(data.idleMinutes)
  if ('throughputPerHour' in data) patch.throughput_per_hour = intOrNull(data.throughputPerHour)

  try {
    await saveBoostConfig(payload, patch)
    return apiOk()
  } catch (e: any) {
    return apiError(`Не удалось сохранить: ${e?.message || e}`, 500)
  }
})

function strOrNull(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s || null
}
function intOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}
function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
