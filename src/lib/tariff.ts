/**
 * Модель платформенного сбора с автора (учёт, без списания — биллинг-провайдера
 * ещё нет). Ядро — одна формула вместо двух режимов:
 *
 *   сбор_за_месяц = max( КОМИССИЯ × выручка , занятые_ГБ × СТАВКА )
 *
 * - Нет подписчиков (выручка ≈ 0) → сбор = ГБ × ставка (это «тариф за хранилище»).
 * - Есть выручка → если комиссия ≥ стоимости хранилища, фиксированный тариф
 *   исчезает; иначе берётся большее из двух (хранилище всё равно покрыто).
 * - Первые 30 дней (триал) сбор = 0 при объёме до TRIAL_GB.
 *
 * Грейды — это потолки хранилища (место = прямой расход ~2 ₽/ГБ/мес). Превышение
 * потолка → апселл на грейд выше или overage по той же ставке. Себестоимость
 * 2 ₽/ГБ, ставка 3 ₽/ГБ (маржа ~50%, параметр настраиваемый).
 *
 * Раздел «Тариф» в студии показывает автору расчётный сбор; фактическое списание
 * подключится вместе с платёжным провайдером (сплит-платежи РФ).
 */

/** Комиссия платформы с выручки автора (доля). */
export const COMMISSION_RATE = 0.1
/** Ставка за хранилище, ₽/ГБ/мес (себестоимость 2 ₽ + маржа). */
export const STORAGE_RATE_RUB = 3
/** Себестоимость места, ₽/ГБ/мес (для справки в UI). */
export const STORAGE_COST_RUB = 2
/** Длительность бесплатного триала, дней. */
export const TRIAL_DAYS = 30
/** Бесплатный объём в триале, ГБ. */
export const TRIAL_GB = 15
/** Минимальная цена подписки при наличии своего видео, ₽/мес. */
export const MIN_VIDEO_TIER_PRICE_RUB = 300

const GB = 1024 * 1024 * 1024

export type TariffGradeKey = 'trial' | 'start' | 'pro' | 'studio'

export interface TariffGrade {
  key: TariffGradeKey
  label: string
  /** Потолок хранилища, ГБ. */
  ceilingGb: number
}

/** Грейды = потолки хранилища. Триал — первые 30 дней. */
export const TARIFF_GRADES: TariffGrade[] = [
  { key: 'trial', label: 'Триал', ceilingGb: TRIAL_GB },
  { key: 'start', label: 'Старт', ceilingGb: 50 },
  { key: 'pro', label: 'Про', ceilingGb: 250 },
  { key: 'studio', label: 'Студия', ceilingGb: 1024 },
]

export interface TariffInput {
  /** Занятое место в байтах (сумма media/gallery/downloads/video/audio). */
  bytes: number
  /** Выручка автора за месяц, ₽ (MRR активных платных подписок). */
  mrrRub: number
  /** Дата создания проекта — начало отсчёта триала. */
  createdAt?: string | Date | null
  /** «Сейчас» для расчётов (по умолчанию текущее время). Для тестов/SSR. */
  now?: Date
}

export interface TariffResult {
  usedGb: number
  usedBytes: number
  /** Активен ли триал (первые TRIAL_DAYS дней). */
  trialActive: boolean
  /** Когда заканчивается триал (ISO), null если даты создания нет. */
  trialEndsAt: string | null
  /** Сколько дней триала осталось (0 если закончился/неизвестно). */
  trialDaysLeft: number
  /** Текущий грейд (по объёму; в триале — 'trial'). */
  grade: TariffGrade
  /** Следующий грейд для апселла (null, если уже максимум). */
  nextGrade: TariffGrade | null
  /** Превышен ли потолок текущего грейда. */
  overCeiling: boolean
  /** Стоимость хранилища за месяц, ₽ (ГБ × ставка). */
  storageFeeRub: number
  /** Комиссия с выручки за месяц, ₽ (выручка × доля). */
  commissionFeeRub: number
  /** Итоговый расчётный сбор, ₽ (в триале — 0). */
  feeRub: number
  /** Себестоимость места для платформы, ₽ (справочно). */
  costRub: number
}

function toBytesGb(bytes: number): number {
  return bytes > 0 ? bytes / GB : 0
}

/** Грейд по объёму: наименьший, чей потолок ≥ занятого места (иначе максимум). */
function gradeForGb(usedGb: number): TariffGrade {
  const nonTrial = TARIFF_GRADES.filter((g) => g.key !== 'trial')
  for (const g of nonTrial) {
    if (usedGb <= g.ceilingGb) return g
  }
  return nonTrial[nonTrial.length - 1]
}

/** Расчёт платформенного сбора и состояния грейда/триала для тенанта. */
export function computeTariff(input: TariffInput): TariffResult {
  const usedBytes = Math.max(0, Number(input.bytes) || 0)
  const usedGb = toBytesGb(usedBytes)
  const mrr = Math.max(0, Number(input.mrrRub) || 0)
  const now = input.now ?? new Date()

  // Триал: TRIAL_DAYS от даты создания проекта.
  let trialActive = false
  let trialEndsAt: string | null = null
  let trialDaysLeft = 0
  if (input.createdAt) {
    const created = new Date(input.createdAt)
    if (!Number.isNaN(created.getTime())) {
      const end = new Date(created.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
      trialEndsAt = end.toISOString()
      const msLeft = end.getTime() - now.getTime()
      trialActive = msLeft > 0
      trialDaysLeft = trialActive ? Math.ceil(msLeft / (24 * 60 * 60 * 1000)) : 0
    }
  }

  const storageFeeRub = Math.round(usedGb * STORAGE_RATE_RUB)
  const commissionFeeRub = Math.round(mrr * COMMISSION_RATE)
  const costRub = Math.round(usedGb * STORAGE_COST_RUB)
  const computed = Math.max(commissionFeeRub, storageFeeRub)
  const feeRub = trialActive ? 0 : computed

  const grade = trialActive ? TARIFF_GRADES[0] : gradeForGb(usedGb)
  const idx = TARIFF_GRADES.findIndex((g) => g.key === grade.key)
  const nextGrade = idx >= 0 && idx < TARIFF_GRADES.length - 1 ? TARIFF_GRADES[idx + 1] : null
  const overCeiling = usedGb > grade.ceilingGb

  return {
    usedGb: Math.round(usedGb * 100) / 100,
    usedBytes,
    trialActive,
    trialEndsAt,
    trialDaysLeft,
    grade,
    nextGrade,
    overCeiling,
    storageFeeRub,
    commissionFeeRub,
    feeRub,
    costRub,
  }
}
