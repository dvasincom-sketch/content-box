import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { checkEmbedAvailability } from '@/lib/vkValidate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Валидатор внешних (embed) видео: параллельно фетчит embed-src, помечает
 * `embedStatus` (ok/unavailable/unknown) и `embedCheckedAt`. Защита CRON_SECRET.
 * Проверки идут пулом (concurrency), чтобы сотни видео укладывались в минуты, а
 * не в десятки минут (иначе curl/раннер отваливается по таймауту).
 *   0 4 * * * curl -fsS -X POST https://<домен>/api/videos/validate -H "Authorization: Bearer $CRON_SECRET"
 * Параметры: ?limit= (по умолч. 200), ?recheckHours= (не перепроверять свежие, 24),
 *            ?concurrency= (по умолч. 10).
 */
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length || 1) }, async () => {
    while (i < items.length) {
      const idx = i++
      await fn(items[idx])
    }
  })
  await Promise.all(workers)
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET не задан.' }, { status: 503 })
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-cron-secret')
  if (bearer !== secret) return NextResponse.json({ error: 'Не авторизовано.' }, { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit')) || 200))
  const rhParam = url.searchParams.get('recheckHours')
  // Внимание: `Number(x) || 24` считает 0 ложным → recheckHours=0 не работал.
  const recheckHours = rhParam !== null && rhParam !== '' ? Math.max(0, Number(rhParam) || 0) : 24
  const concurrency = Math.min(20, Math.max(1, Number(url.searchParams.get('concurrency')) || 10))
  const cutoff = new Date(Date.now() - recheckHours * 3600_000).toISOString()

  const payload = await getPayload({ config: await config })
  const res = await payload.find({
    collection: 'videos',
    where: {
      and: [
        { provider: { equals: 'embed' } },
        { embedSrc: { exists: true } },
        { or: [{ embedCheckedAt: { exists: false } }, { embedCheckedAt: { less_than: cutoff } }] },
      ],
    },
    limit,
    depth: 0,
    overrideAccess: true,
    sort: 'embedCheckedAt',
  })

  const docs = res.docs as { id: string | number; embedSrc?: string }[]
  const counts = { ok: 0, unavailable: 0, unknown: 0 }

  await mapLimit(docs, concurrency, async (v) => {
    const status = await checkEmbedAvailability(v.embedSrc || '')
    if (status === 'unavailable') counts.unavailable++
    else if (status === 'ok') counts.ok++
    else counts.unknown++
    try {
      await payload.update({
        collection: 'videos',
        id: v.id,
        data: { embedStatus: status, embedCheckedAt: new Date().toISOString() } as never,
        overrideAccess: true,
        depth: 0,
      })
    } catch {
      /* пропускаем одиночную ошибку записи */
    }
  })

  return NextResponse.json({ ok: true, checked: docs.length, ok_count: counts.ok, unavailable: counts.unavailable, unknown: counts.unknown })
}
