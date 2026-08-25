import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { reconcile } from '@/lib/boost'
import { sqlRows } from '@/lib/sql'
import { listServers, deleteServer } from '@/lib/timeweb'

/**
 * Тик оркестратора boost — дёргается планировщиком (~раз в минуту) c секретом
 * `BOOST_TICK_SECRET` в заголовке `x-boost-secret`.
 *
 *  1) reconcile — двигает машину состояний boost_runs (провижининг→актив, гашение
 *     по простою, watchdog по max-lifetime).
 *  2) orphan sweep — удаляет серверы Timeweb с префиксом `boost-`, на которые нет
 *     активного прогона в БД (страховка от утечки денег).
 *
 * Настроить крон (пример compose-сайдкар или Timeweb cron):
 *   * * * * * curl -fsS -X POST -H "x-boost-secret: $BOOST_TICK_SECRET" https://<app>/api/boost/tick
 */
export const runtime = 'nodejs'

function eq(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  try { return timingSafeEqual(ab, bb) } catch { return false }
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.BOOST_TICK_SECRET || ''
  if (!secret) return NextResponse.json({ error: 'BOOST_TICK_SECRET не задан' }, { status: 503 })
  const given = req.headers.get('x-boost-secret') || ''
  if (!eq(given, secret)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const payload = await getPayload({ config: await config })

  let advanced = 0
  try { advanced = (await reconcile(payload)).advanced } catch (e) { /* продолжаем к sweep */ }

  // Orphan sweep — best-effort.
  let orphansDeleted = 0
  if ((process.env.BOOST_ORPHAN_SWEEP || '1') !== '0') {
    try {
      const active = await sqlRows<{ timeweb_server_id: string }>(
        payload,
        `SELECT timeweb_server_id FROM boost_runs WHERE status NOT IN ('done','failed') AND timeweb_server_id IS NOT NULL`,
      )
      const keep = new Set(active.map((r) => String(r.timeweb_server_id)))
      const servers = await listServers()
      for (const s of servers) {
        const name = String(s.raw?.name || '')
        if (name.startsWith('boost-') && !keep.has(String(s.id))) {
          try { await deleteServer(s.id); orphansDeleted++ } catch { /* попробуем в следующий тик */ }
        }
      }
    } catch { /* сеть/ключ — не критично */ }
  }

  return NextResponse.json({ ok: true, advanced, orphansDeleted })
}
