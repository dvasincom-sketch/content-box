import type { Payload } from 'payload'

/**
 * Общая валидация и маппинг для API трансляций (studio/api/streams/*).
 * Файл с префиксом `_` не является роутом Next.
 */

export type StreamInput = {
  title: string
  description: string | null
  scheduledAt: string
  endsAt: string
  isOpen: boolean
  minTier: number | null
  playbackUrl: string
  coverId: number | null
  chatEnabled: boolean
  moderatorEmails: string[]
  saveRecording: boolean
  ingestServer: string | null
  ingestKey: string | null
  recordingUrl: string | null
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const bool = (v: unknown) => v === true || v === '1' || v === 'true'
const orNull = (v: unknown) => {
  const s = str(v)
  return s ? s : null
}

/** Список email из массива ИЛИ строки (переносы/запятые/;) → нормализованный. */
const emailList = (v: unknown): string[] => {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[\n,;]+/) : []
  return Array.from(new Set(arr.map((x) => String(x ?? '').trim().toLowerCase()).filter(Boolean)))
}

/** Проверяет вход и принадлежность связей тенанту. */
export async function validateStreamInput(
  data: any,
  payload: Payload,
  tenantId: number,
): Promise<{ data: StreamInput } | { error: string }> {
  const title = str(data.title)
  if (!title) return { error: 'Укажите название' }

  const scheduledAt = str(data.scheduledAt)
  const endsAt = str(data.endsAt)
  if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt))) return { error: 'Укажите время начала' }
  if (!endsAt || Number.isNaN(Date.parse(endsAt))) return { error: 'Укажите время окончания' }
  if (Date.parse(endsAt) <= Date.parse(scheduledAt)) return { error: 'Окончание должно быть позже начала' }

  const playbackUrl = str(data.playbackUrl)
  if (!playbackUrl) return { error: 'Вставьте ссылку просмотра от Castr' }

  const isOpen = bool(data.isOpen)
  // Уровень доступа обязателен только для закрытой (подписочной) трансляции.
  let minTier: number | null = null
  if (!isOpen) {
    if (data.minTierId == null || data.minTierId === '') {
      return { error: 'Выберите уровень доступа или сделайте трансляцию открытой' }
    }
    const t: any = await payload
      .findByID({ collection: 'subscription-tiers', id: data.minTierId, depth: 0, overrideAccess: true })
      .catch(() => null)
    const tt = t && (typeof t.tenant === 'object' ? t.tenant.id : t.tenant)
    if (!t || Number(tt) !== Number(tenantId)) return { error: 'Уровень доступа не найден' }
    minTier = Number(data.minTierId)
  }

  let coverId: number | null = null
  if (data.coverId != null && data.coverId !== '') {
    const m: any = await payload
      .findByID({ collection: 'media', id: data.coverId, depth: 0, overrideAccess: true })
      .catch(() => null)
    const mt = m && (typeof m.tenant === 'object' ? m.tenant.id : m.tenant)
    coverId = m && Number(mt) === Number(tenantId) ? Number(data.coverId) : null
  }

  return {
    data: {
      title,
      description: orNull(data.description),
      scheduledAt: new Date(scheduledAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      isOpen,
      minTier,
      playbackUrl,
      coverId,
      chatEnabled: data.chatEnabled == null ? true : bool(data.chatEnabled),
      moderatorEmails: emailList(data.moderatorEmails),
      saveRecording: bool(data.saveRecording),
      ingestServer: orNull(data.ingestServer),
      ingestKey: orNull(data.ingestKey),
      recordingUrl: orNull(data.recordingUrl),
    },
  }
}

/** StreamInput → data для payload.create/update (coverId → cover). */
export function toPayloadData(v: StreamInput) {
  return {
    title: v.title,
    description: v.description,
    scheduledAt: v.scheduledAt,
    endsAt: v.endsAt,
    isOpen: v.isOpen,
    minTier: v.minTier,
    playbackUrl: v.playbackUrl,
    cover: v.coverId,
    chatEnabled: v.chatEnabled,
    moderatorEmails: v.moderatorEmails,
    saveRecording: v.saveRecording,
    ingestServer: v.ingestServer,
    ingestKey: v.ingestKey,
    recordingUrl: v.recordingUrl,
  }
}

/** Документ трансляции → плоский элемент для студии. */
export function mapStream(d: any) {
  const cover = d.cover && typeof d.cover === 'object' ? d.cover : null
  const tier = d.minTier && typeof d.minTier === 'object' ? d.minTier : null
  return {
    id: d.id,
    title: d.title || 'Без названия',
    description: d.description || '',
    slug: d.slug || '',
    scheduledAt: d.scheduledAt || null,
    endsAt: d.endsAt || null,
    coverId: d.cover ? String(typeof d.cover === 'object' ? d.cover.id : d.cover) : '',
    coverUrl: cover?.sizes?.card?.url || cover?.url || null,
    isOpen: Boolean(d.isOpen),
    minTierId: d.minTier ? String(typeof d.minTier === 'object' ? d.minTier.id : d.minTier) : '',
    minTierName: tier ? tier.name || tier.slug || null : null,
    chatEnabled: d.chatEnabled !== false,
    moderatorEmails: Array.isArray(d.moderatorEmails)
      ? (d.moderatorEmails as unknown[]).map((x) => String(x ?? '').trim().toLowerCase()).filter(Boolean)
      : [],
    saveRecording: Boolean(d.saveRecording),
    playbackUrl: d.playbackUrl || '',
    ingestServer: d.ingestServer || '',
    ingestKey: d.ingestKey || '',
    recordingUrl: d.recordingUrl || '',
  }
}
