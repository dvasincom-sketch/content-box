import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { publishedWhere } from '@/lib/published'
import { emailBrandForTenant, digestEmail, type DigestItem } from '@/emails'

/**
 * Планировщик дайджеста. Дёргается по расписанию (внешний cron) с секретом
 * CRON_SECRET в заголовке `Authorization: Bearer …` или `x-cron-secret`.
 *
 * Для каждого активного тенанта: берём материалы, созданные ПОСЛЕ водяной
 * метки site-settings.lastDigestAt (при первом запуске — за последние N дней),
 * и шлём дайджест подписчикам, которые не отписались и не заблокированы.
 * После рассылки двигаем метку на момент старта запуска.
 *
 * Параметры (query): ?dryRun=1 — ничего не шлём и не двигаем метку, только
 * считаем; ?days=N — окно первого запуска (по умолчанию 7).
 *
 * Мягко: подтверждение email НЕ требуется (шлём и неподтверждённым, если они
 * не отписались) — соответствует «мягкому» режиму верификации.
 */

const DEFAULT_WINDOW_DAYS = 7
const MAX_ITEMS = 25
const MAX_RECIPIENTS = 5000

function makeToken(): string {
  const uuid = () => globalThis.crypto.randomUUID().replace(/-/g, '')
  return uuid() + uuid()
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const header = req.headers.get('x-cron-secret')
  return bearer === secret || header === secret
}

export async function POST(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET не задан.' }, { status: 503 })
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Не авторизовано.' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dryRun = ['1', 'true', 'yes'].includes((url.searchParams.get('dryRun') || '').toLowerCase())
  const daysParam = parseInt(url.searchParams.get('days') || '', 10)
  const windowDays = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : DEFAULT_WINDOW_DAYS

  const runStart = new Date()
  const runStartISO = runStart.toISOString()

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Активные тенанты с подтверждённым доменом — те же условия, что и на
  // регистрации подписчика.
  const tenantsRes = await payload.find({
    collection: 'tenants',
    where: {
      and: [{ status: { equals: 'active' } }, { domainVerified: { equals: true } }],
    },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })

  const report: Array<Record<string, unknown>> = []
  let totalSent = 0

  for (const tenant of tenantsRes.docs as any[]) {
    const tenantId = tenant.id
    const domain = tenant.domain as string | undefined
    if (!domain) continue

    const settingsRes = await payload.find({
      collection: 'site-settings',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })
    const settings = settingsRes.docs[0] as any
    const since = settings?.lastDigestAt
      ? new Date(settings.lastDigestAt)
      : new Date(runStart.getTime() - windowDays * 24 * 60 * 60 * 1000)

    const pubsRes = await payload.find({
      collection: 'publications',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { publishedAt: { greater_than: since.toISOString() } },
          // Черновик, созданный внутри окна, попадал в письмо — и ссылка вела
          // на 404. Хуже: lastDigestAt уходил дальше, и после публикации
          // материал в дайджест уже не попадал никогда. Поэтому и окно теперь
          // считаем по publishedAt, а не по createdAt.
          publishedWhere(),
        ],
      },
      sort: '-publishedAt',
      limit: MAX_ITEMS,
      depth: 1,
      overrideAccess: true,
    })

    const items: DigestItem[] = (pubsRes.docs as any[])
      .filter((d) => d.slug)
      .map((d) => ({
        title: d.title || 'Без названия',
        url: `https://${domain}/publication/${d.slug}`,
        category: d.category && typeof d.category === 'object' ? d.category.title : null,
      }))

    // Новые главы книг с момента метки — для читателей, следящих за книгой.
    const chRes = await payload.find({
      collection: 'chapters' as any,
      where: { and: [{ tenant: { equals: tenantId } }, { publishedAt: { greater_than: since.toISOString() } }] },
      sort: '-publishedAt', limit: 200, depth: 1, overrideAccess: true,
    })
    const chapterItemsByBook = new Map<string, DigestItem[]>()
    for (const ch of chRes.docs as any[]) {
      const b = ch.book && typeof ch.book === 'object' ? ch.book : null
      if (!b?.slug) continue
      const bid = String(b.id)
      if (!chapterItemsByBook.has(bid)) chapterItemsByBook.set(bid, [])
      chapterItemsByBook.get(bid)!.push({
        title: `«${b.title || 'Книга'}»: ${ch.title || 'Новая глава'}`,
        url: `https://${domain}/book/${b.slug}/${Number(ch.order) || 1}`,
        category: 'Новая глава',
      })
    }
    // Подписки читателей на книги (subscriberId → set bookId).
    const followsBySub = new Map<string, Set<string>>()
    if (chapterItemsByBook.size > 0) {
      const bfRes = await payload.find({
        collection: 'book-follows' as any,
        where: { tenant: { equals: tenantId } },
        limit: 20000, depth: 0, overrideAccess: true,
      })
      for (const f of bfRes.docs as any[]) {
        const sid = String(typeof f.subscriber === 'object' ? f.subscriber.id : f.subscriber)
        const bid = String(typeof f.book === 'object' ? f.book.id : f.book)
        if (!followsBySub.has(sid)) followsBySub.set(sid, new Set())
        followsBySub.get(sid)!.add(bid)
      }
    }

    let recipients = 0
    let sent = 0
    let failed = 0

    if (items.length > 0 || chapterItemsByBook.size > 0) {
      const subsRes = await payload.find({
        collection: 'subscribers',
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { isBlocked: { not_equals: true } },
            { notifyDigest: { not_equals: false } },
          ],
        },
        limit: MAX_RECIPIENTS,
        depth: 0,
        overrideAccess: true,
      })
      recipients = subsRes.docs.length
      const brand = emailBrandForTenant(tenant, settings)
      const siteUrl = `https://${domain}`

      for (const sub of subsRes.docs as any[]) {
        if (!sub.email) continue
        // Персональные позиции: общие публикации + новые главы книг, за которыми
        // следит этот читатель.
        let chItems: DigestItem[] = []
        const followed = followsBySub.get(String(sub.id))
        if (followed) for (const bid of followed) { const arr = chapterItemsByBook.get(bid); if (arr) chItems = chItems.concat(arr) }
        const personalItems = items.concat(chItems)
        if (personalItems.length === 0) continue
        let token = sub.unsubscribeToken as string | undefined
        if (!token) {
          token = makeToken()
          if (!dryRun) {
            try {
              await payload.update({
                collection: 'subscribers',
                id: sub.id,
                data: { unsubscribeToken: token } as any,
                overrideAccess: true,
              })
            } catch {
              // не критично — отпишется по повторной ссылке позже
            }
          }
        }
        const mail = digestEmail({
          brand,
          siteUrl,
          items: personalItems,
          unsubscribeUrl: `${siteUrl}/unsubscribe?token=${encodeURIComponent(token)}`,
        })
        if (dryRun) {
          sent++
          continue
        }
        try {
          await payload.sendEmail({ to: sub.email, subject: mail.subject, html: mail.html })
          sent++
        } catch {
          failed++
        }
      }
    }

    // Двигаем метку на старт запуска — даже если материалов не было, чтобы
    // окно не разрасталось. Только для реального запуска и при наличии
    // документа настроек.
    if (!dryRun && settings?.id) {
      try {
        await payload.update({
          collection: 'site-settings',
          id: settings.id,
          data: { lastDigestAt: runStartISO } as any,
          overrideAccess: true,
        })
      } catch {
        // метка не двинулась — в следующий раз возьмём то же окно
      }
    }

    totalSent += sent
    report.push({
      tenant: tenant.name || tenantId,
      domain,
      since: since.toISOString(),
      items: items.length,
      recipients,
      sent,
      failed,
    })
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    runAt: runStartISO,
    tenants: report.length,
    totalSent,
    detail: report,
  })
}
