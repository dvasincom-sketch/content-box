import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { checkEmbedAvailability } from '@/lib/vkValidate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Валидатор внешних (embed) видео: фетчит embed-src, помечает `embedStatus`
 * (ok/unavailable/unknown) и `embedCheckedAt`. Защита CRON_SECRET (как дайджест).
 * Планировщик — внешний cron, напр. раз в сутки:
 *   0 4 * * * curl -fsS -X POST https://<домен>/api/videos/validate -H "Authorization: Bearer $CRON_SECRET"
 * Параметры: ?limit= (по умолч. 200), ?recheckHours= (не перепроверять свежие, 24).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET не задан.' }, { status: 503 })
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-cron-secret')
  if (bearer !== secret) return NextResponse.json({ error: 'Не авторизовано.' }, { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit')) || 200))
  const recheckHours = Math.max(0, Number(url.searchParams.get('recheckHours')) || 24)
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

  let ok = 0
  let unavailable = 0
  let unknown = 0
  for (const v of res.docs as { id: string | number; embedSrc?: string }[]) {
    const status = await checkEmbedAvailability(v.embedSrc || '')
    if (status === 'unavailable') unavailable++
    else if (status === 'ok') ok++
    else unknown++
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
  }
  return NextResponse.json({ ok: true, checked: res.docs.length, ok_count: ok, unavailable, unknown })
}
