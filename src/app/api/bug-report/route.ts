import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rateLimit'
import { stripPort } from '@/lib/subdomain'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { awardActivity } from '@/lib/reputation'

/**
 * Приём баг-репортов (баг-баунти). ПУБЛИЧНЫЙ роут: писать может и аноним.
 *
 * Тенант определяется ПО ДОМЕНУ запроса (как в register-subscriber) — proxy.ts
 * исключает /api/* и заголовок x-tenant-id туда не ставит. Любой tenant из тела
 * игнорируется. Создаём через overrideAccess после рейт-лимита и валидации,
 * поэтому коллекция закрыта для прямого публичного create.
 *
 * Тело: { description, pageUrl, pageTitle?, source?, anonymous?, viewport? }
 * userAgent берём из заголовка запроса, а не из тела (не доверяем клиенту).
 */
export async function POST(req: NextRequest) {
  // Анти-спам по IP: 15 отчётов за 15 минут. Память процесса (см. rateLimit.ts).
  const ip = clientIp(req.headers)
  const rl = rateLimit(`bug-report:${ip}`, 15, 15 * 60 * 1000)
  if (!rl.ok) {
    return tooManyRequests(rl.retryAfter, 'Слишком много отчётов. Попробуйте позже.')
  }

  const host = stripPort(req.headers.get('x-forwarded-host') ?? req.headers.get('host'))
  if (!host) {
    return NextResponse.json({ error: 'Не удалось определить сайт.' }, { status: 400 })
  }

  let body: {
    description?: string
    pageUrl?: string
    pageTitle?: string
    source?: string
    anonymous?: boolean
    viewport?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос.' }, { status: 400 })
  }

  const description = String(body.description || '').trim()
  const pageUrl = String(body.pageUrl || '').trim().slice(0, 2000)
  const pageTitle = String(body.pageTitle || '').trim().slice(0, 300)
  const source = body.source === 'studio' ? 'studio' : 'site'
  const anonymous = Boolean(body.anonymous)
  const userAgent = String(req.headers.get('user-agent') || '').slice(0, 500)
  const viewport = String(body.viewport || '').trim().slice(0, 40)

  if (description.length < 5) {
    return NextResponse.json({ error: 'Опишите ошибку подробнее (минимум 5 символов).' }, { status: 400 })
  }
  if (description.length > 4000) {
    return NextResponse.json({ error: 'Слишком длинное описание (максимум 4000 символов).' }, { status: 400 })
  }
  if (!pageUrl) {
    return NextResponse.json({ error: 'Не удалось определить страницу.' }, { status: 400 })
  }

  const payload = await getPayload({ config: await config })

  // Тенант по домену: active + domainVerified (та же логика, что и в proxy).
  const tenantsRes = await payload.find({
    collection: 'tenants',
    where: {
      and: [
        { domain: { equals: host } },
        { status: { equals: 'active' } },
        { domainVerified: { equals: true } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const tenant = tenantsRes.docs[0] as { id: number } | undefined
  if (!tenant) {
    return NextResponse.json({ error: 'Не удалось определить сайт (домен не распознан).' }, { status: 400 })
  }
  const tenantId = tenant.id

  // Кто отправляет. Подписчик сайта (subscribers) — участник очковой системы.
  // В студии автор — это `users`, очков ему не начисляем, но «кто» фиксируем
  // отдельной связью reporterUser. Автор считается своим, только если его тенант
  // совпадает с тенантом домена (без кросс-тенант привязки).
  const subscriber = await getCurrentSubscriber(tenantId)
  const author = subscriber ? null : await getCurrentAuthor()
  const authorUserId =
    author && Number(author.tenantId) === Number(tenantId) ? (author.user.id as number) : null

  // Разрешаем отправку, если это подписчик, автор студии или явное согласие на
  // анонимность. Иначе непонятно, от кого отчёт.
  if (!subscriber && !authorUserId && !anonymous) {
    return NextResponse.json({ error: 'Войдите, чтобы получить очки, или отправьте анонимно.' }, { status: 400 })
  }

  // Подписчика привязываем, только если он НЕ выбрал анонимность (тогда очки).
  // Автора студии привязываем, если нет подписчика.
  const subscriberId = subscriber && !anonymous ? (subscriber.id as number) : null
  const reporterUserId = !subscriberId ? authorUserId : null

  let created: { id: number | string }
  try {
    created = await payload.create({
      collection: 'bug-reports',
      data: {
        tenant: tenantId,
        description,
        pageUrl,
        pageTitle: pageTitle || undefined,
        source,
        // Анонимно, только если не привязан ни подписчик, ни автор студии.
        anonymous: anonymous || (!subscriberId && !reporterUserId),
        subscriber: subscriberId ?? undefined,
        reporterUser: reporterUserId ?? undefined,
        userAgent: userAgent || undefined,
        viewport: viewport || undefined,
        status: 'new',
      } as never,
      overrideAccess: true,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Не удалось отправить отчёт.' }, { status: 400 })
  }

  // Гибрид: +1 очко сразу авторизованному (не анониму). Основной бонус — при
  // подтверждении модератором (хук коллекции). Best-effort.
  let awarded = false
  if (subscriberId) {
    try {
      await awardActivity(payload, {
        subscriberId,
        type: 'bug_submitted',
        refType: 'bug-report',
        refId: created.id,
      })
      awarded = true
    } catch {
      /* очки best-effort */
    }
  }

  return NextResponse.json({ ok: true, awarded })
}
