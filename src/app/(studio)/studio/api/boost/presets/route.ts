import { withAuthor, apiError, authorCan } from '@/app/(studio)/studio/api/_lib'
import { NextResponse } from 'next/server'
import { listPresets } from '@/lib/timeweb'

/**
 * Список тарифов Timeweb для выбора пресета в панели boost (owner/финансовое право).
 * Отдаём только dedicated-CPU, отсортированные по числу ядер (это то, что нужно
 * для транскода). Требует TIMEWEB_TOKEN в env.
 */
export const GET = withAuthor(async ({ author }) => {
  if (!authorCan(author, 'tiers', 'manage')) return apiError('Недостаточно прав', 403)
  try {
    const all = await listPresets()
    const items = all
      .filter((p) => p.raw?.is_dedicated_cpu === true)
      .map((p) => ({
        id: p.id,
        cpu: p.cpu,
        ramGb: p.ramMb != null ? Math.round(p.ramMb / 1024) : null,
        diskGb: p.diskMb != null ? Math.round(p.diskMb / 1024) : null,
        location: p.location,
        priceMonth: p.priceMonth,
        pricePerHour: p.pricePerHour,
      }))
      .sort((a, b) => (a.cpu || 0) - (b.cpu || 0))
    return NextResponse.json({ items })
  } catch (e: any) {
    return apiError(`Не удалось получить тарифы Timeweb: ${e?.message || e}`, 502)
  }
})
