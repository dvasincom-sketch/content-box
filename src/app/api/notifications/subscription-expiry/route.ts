import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { SubscriptionNoticeKind } from '@/emails'
import { isSyntheticEmail } from '@/lib/authEmail'
import {
  REMIND_DAYS,
  loadTenantNoticeCtx,
  buildSubscriptionMail,
  sendSubscriptionNoticeTest,
  type TenantNoticeCtx,
} from '@/lib/subscriptionNotices'

/**
 * Письма об окончании платной подписки. Дёргается по расписанию (раз в час,
 * .github/workflows/scheduled.yml) с CRON_SECRET — как дайджест.
 *
 *  - reminder: подписка закончится в ближайшие REMIND_DAYS (3) дня →
 *      «Через 3 дня закончится ваша подписка» (или «мы продлим», если autoRenew);
 *  - expired:  подписка закончилась (не раньше чем GRACE_HOURS назад — запас на
 *      продление/вебхук оплаты, и не позже CATCHUP_DAYS — чтобы при первом
 *      запуске не написать всем, у кого подписка кончилась полгода назад).
 *
 * Повторов нет: после отправки в subscribers.expiryReminderFor / expiryNoticeFor
 * кладём дату окончания, про которую написали. Продлил и снова истёк — дата
 * другая → письмо уйдёт снова.
 *
 * Письмо служебное (о покупке) — шлём и тем, кто отключил дайджест, но не
 * заблокированным и не на синтетические адреса телефонных аккаунтов.
 *
 * Query: ?dryRun=1 — только посчитать (ничего не шлём, отметки не ставим);
 *        ?domain=<host> — только один тенант;
 *        ?to=<email>&domain=<host> — тест: ОБА вида письма на этот адрес.
 * Тест без терминала — кнопка в студии (/studio/api/subscription-notice-test).
 */

const GRACE_HOURS = 2
const CATCHUP_DAYS = 7
const MAX_PER_RUN = 500

type PoolLike = { query: (text: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const header = req.headers.get('x-cron-secret')
  return bearer === secret || header === secret
}

export async function POST(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET не задан.' }, { status: 503 })
  if (!authorized(req)) return NextResponse.json({ error: 'Не авторизовано.' }, { status: 401 })

  const url = new URL(req.url)
  const dryRun = ['1', 'true', 'yes'].includes((url.searchParams.get('dryRun') || '').toLowerCase())
  const domainFilter = (url.searchParams.get('domain') || '').trim().toLowerCase()
  const testTo = (url.searchParams.get('to') || '').trim()

  const payload = await getPayload({ config: await config })

  // ── Тестовая отправка обоих писем на указанный адрес ─────────────────────
  if (testTo) {
    if (!domainFilter) return NextResponse.json({ error: 'Для теста укажите ?domain=' }, { status: 400 })
    const tRes = await payload.find({ collection: 'tenants', where: { domain: { equals: domainFilter } }, limit: 1, depth: 0, overrideAccess: true })
    const tenant = tRes.docs[0] as any
    if (!tenant) return NextResponse.json({ error: 'Тенант не найден' }, { status: 404 })
    try {
      const sent = await sendSubscriptionNoticeTest(payload, Number(tenant.id), testTo)
      return NextResponse.json({ ok: true, test: true, to: testTo, sent })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Не удалось отправить' }, { status: 500 })
    }
  }

  const pool = (payload.db as unknown as { pool?: PoolLike }).pool
  if (!pool || typeof pool.query !== 'function') return NextResponse.json({ error: 'База недоступна' }, { status: 500 })

  const [remindRes, expiredRes] = await Promise.all([
    pool.query(
      `SELECT id FROM subscribers
        WHERE active_tier_id IS NOT NULL
          AND subscription_until > now()
          AND subscription_until <= now() + make_interval(days => $1::int)
          AND (expiry_reminder_for IS NULL OR expiry_reminder_for <> subscription_until)
          AND COALESCE(is_blocked, false) = false
        ORDER BY subscription_until ASC
        LIMIT $2`,
      [REMIND_DAYS, MAX_PER_RUN],
    ),
    pool.query(
      `SELECT id FROM subscribers
        WHERE active_tier_id IS NOT NULL
          AND subscription_until <= now() - make_interval(hours => $1::int)
          AND subscription_until > now() - make_interval(days => $2::int)
          AND (expiry_notice_for IS NULL OR expiry_notice_for <> subscription_until)
          AND COALESCE(is_blocked, false) = false
        ORDER BY subscription_until ASC
        LIMIT $3`,
      [GRACE_HOURS, CATCHUP_DAYS, MAX_PER_RUN],
    ),
  ])

  const jobs: Array<{ id: number; kind: SubscriptionNoticeKind }> = [
    ...remindRes.rows.map((r) => ({ id: Number(r.id), kind: 'reminder' as const })),
    ...expiredRes.rows.map((r) => ({ id: Number(r.id), kind: 'expired' as const })),
  ]
  if (jobs.length === 0) return NextResponse.json({ ok: true, dryRun, sent: 0, detail: [] })

  const docs = (
    await payload.find({
      collection: 'subscribers',
      where: { id: { in: [...new Set(jobs.map((j) => j.id))] } },
      limit: jobs.length,
      depth: 1,
      overrideAccess: true,
    })
  ).docs as any[]
  const byId = new Map(docs.map((d) => [Number(d.id), d]))

  const tenantCache = new Map<number, TenantNoticeCtx | null>()
  const detail: Array<Record<string, unknown>> = []
  let sent = 0
  let failed = 0
  let skipped = 0

  for (const job of jobs) {
    const sub = byId.get(job.id)
    if (!sub) continue
    const tenantId = Number(typeof sub.tenant === 'object' ? sub.tenant?.id : sub.tenant)
    if (!tenantCache.has(tenantId)) tenantCache.set(tenantId, await loadTenantNoticeCtx(payload, tenantId))
    const ctx = tenantCache.get(tenantId)
    if (!ctx || !ctx.ok) { skipped++; continue }
    if (domainFilter && ctx.domain.toLowerCase() !== domainFilter) continue

    const until = sub.subscriptionUntil ? new Date(sub.subscriptionUntil).toISOString() : null
    const email = String(sub.email || '')
    const tier = sub.activeTier && typeof sub.activeTier === 'object' ? sub.activeTier : null
    const markField = job.kind === 'reminder' ? 'expiryReminderFor' : 'expiryNoticeFor'
    const mark = async () => {
      if (dryRun || !until) return
      await payload
        .update({
          collection: 'subscribers',
          id: sub.id,
          data: { [markField]: until } as any,
          overrideAccess: true,
          context: { skipSubscriptionEvent: true },
        })
        .catch(() => {})
    }

    // Нет реального адреса — писать некуда; ставим отметку, чтобы не перебирать каждый час.
    if (!until || !email || isSyntheticEmail(email)) { skipped++; await mark(); continue }

    const mail = buildSubscriptionMail(ctx, job.kind, {
      tierId: tier?.id ?? null,
      tierName: tier?.name || 'Подписка',
      priceRub: Number(tier?.priceRub) || null,
      until,
      autoRenew: Boolean(sub.autoRenew && sub.yookassaPaymentMethodId),
      name: sub.displayName || null,
    })

    if (dryRun) {
      sent++
      detail.push({ kind: job.kind, domain: ctx.domain, email, until })
      continue
    }
    try {
      await payload.sendEmail({ to: email, subject: mail.subject, html: mail.html })
      sent++
      detail.push({ kind: job.kind, domain: ctx.domain, email, until })
      await mark()
    } catch {
      failed++ // отметку не ставим — попробуем в следующий запуск
    }
  }

  return NextResponse.json({ ok: true, dryRun, sent, failed, skipped, detail })
}
