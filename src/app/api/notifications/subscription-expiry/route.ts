import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { emailBrandForTenant, subscriptionNoticeEmail, type SubscriptionNoticeKind } from '@/emails'
import { isSyntheticEmail } from '@/lib/authEmail'

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
 *        ?to=<email>&domain=<host> — тест: отправить ОБА вида письма на этот
 *          адрес с первым активным тарифом тенанта (без поиска подписчиков).
 */

const REMIND_DAYS = 3
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

/** Контекст тенанта для писем: бренд, домен, аватар автора. Кэшируется на запуск. */
type TenantCtx = { ok: boolean; domain: string; name: string; brand: ReturnType<typeof emailBrandForTenant>; avatarUrl: string | null }

async function loadTenantCtx(payload: Payload, tenantId: number): Promise<TenantCtx | null> {
  const tenant = (await payload
    .findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })
    .catch(() => null)) as any
  if (!tenant?.domain) return null
  const sRes = await payload
    .find({ collection: 'site-settings', where: { tenant: { equals: tenantId } }, limit: 1, depth: 1, overrideAccess: true })
    .catch(() => null)
  const settings = (sRes?.docs?.[0] as any) ?? null
  const domain = String(tenant.domain)
  const abs = (u: unknown): string | null => {
    if (typeof u !== 'string' || !u) return null
    return u.startsWith('/') ? `https://${domain}${u}` : u
  }
  const icon = settings?.appIcon && typeof settings.appIcon === 'object' ? settings.appIcon : null
  const logo = settings?.logo && typeof settings.logo === 'object' ? settings.logo : null
  const brand = emailBrandForTenant(tenant, settings)
  // Лого в шапке письма тоже должно быть абсолютным URL.
  brand.logoUrl = abs(brand.logoUrl)
  return {
    // Те же условия, что у дайджеста: активный тенант с подтверждённым доменом.
    ok: tenant.status === 'active' && tenant.domainVerified === true,
    domain,
    name: String(tenant.name || brand.name || domain),
    brand,
    avatarUrl: abs(icon?.sizes?.thumbnail?.url || icon?.url) || abs(logo?.sizes?.thumbnail?.url || logo?.url),
  }
}

function buildMail(
  ctx: TenantCtx,
  kind: SubscriptionNoticeKind,
  args: { tierId: number | string | null; tierName: string; priceRub: number | null; until: string; autoRenew: boolean; name?: string | null },
) {
  const siteUrl = `https://${ctx.domain}`
  const daysLeft = Math.max(1, Math.ceil((new Date(args.until).getTime() - Date.now()) / 86_400_000))
  return subscriptionNoticeEmail({
    brand: ctx.brand,
    kind,
    authorName: ctx.name,
    avatarUrl: ctx.avatarUrl,
    tierName: args.tierName,
    priceRub: args.priceRub,
    until: args.until,
    daysLeft,
    autoRenew: args.autoRenew,
    renewUrl: args.tierId != null ? `${siteUrl}/subscribe?tier=${encodeURIComponent(String(args.tierId))}` : `${siteUrl}/subscribe`,
    accountUrl: `${siteUrl}/account/subscription`,
    name: args.name,
  })
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
    const ctx = await loadTenantCtx(payload, tenant.id)
    if (!ctx) return NextResponse.json({ error: 'У тенанта нет домена' }, { status: 400 })
    const tier = (
      await payload.find({
        collection: 'subscription-tiers',
        where: { and: [{ tenant: { equals: tenant.id } }, { isActive: { equals: true } }] },
        sort: 'weight',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0] as any
    const base = { tierId: tier?.id ?? null, tierName: tier?.name || 'Подписка', priceRub: Number(tier?.priceRub) || null, autoRenew: false }
    const soon = new Date(Date.now() + REMIND_DAYS * 86_400_000).toISOString()
    const past = new Date(Date.now() - 3_600_000).toISOString()
    const sent: string[] = []
    for (const [kind, until] of [['reminder', soon], ['expired', past]] as const) {
      const mail = buildMail(ctx, kind, { ...base, until })
      if (!dryRun) await payload.sendEmail({ to: testTo, subject: `[ТЕСТ] ${mail.subject}`, html: mail.html })
      sent.push(mail.subject)
    }
    return NextResponse.json({ ok: true, test: true, dryRun, to: testTo, sent })
  }

  const pool = (payload.db as unknown as { pool?: PoolLike }).pool
  if (!pool || typeof pool.query !== 'function') return NextResponse.json({ error: 'База недоступна' }, { status: 500 })

  // Кандидаты одним запросом на каждый вид письма (без синтетики и блокировок —
  // их отсекаем ниже по документу).
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

  const tenantCache = new Map<number, TenantCtx | null>()
  const detail: Array<Record<string, unknown>> = []
  let sent = 0
  let failed = 0
  let skipped = 0

  for (const job of jobs) {
    const sub = byId.get(job.id)
    if (!sub) continue
    const tenantId = Number(typeof sub.tenant === 'object' ? sub.tenant?.id : sub.tenant)
    if (!tenantCache.has(tenantId)) tenantCache.set(tenantId, await loadTenantCtx(payload, tenantId))
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

    const mail = buildMail(ctx, job.kind, {
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
