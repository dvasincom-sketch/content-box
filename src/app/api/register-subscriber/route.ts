import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { stripPort } from '@/lib/subdomain'

/**
 * Регистрация подписчика с СЕРВЕРНОЙ привязкой тенанта.
 *
 * Тенант определяется ПО ДОМЕНУ запроса напрямую (не через x-tenant-id) —
 * proxy.ts исключает /api/* из своей обработки и заголовок туда не ставит.
 * Поэтому резолвим тенант здесь той же логикой, что и proxy: active +
 * domainVerified по host. Любой tenant из тела запроса игнорируется.
 *
 * Тело: { email, password, displayName? }
 */

export async function POST(req: NextRequest) {
  const host = stripPort(
    req.headers.get('x-forwarded-host') ?? req.headers.get('host'),
  )
  if (!host) {
    return NextResponse.json({ error: 'Не удалось определить сайт.' }, { status: 400 })
  }

  let body: { email?: string; password?: string; displayName?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос.' }, { status: 400 })
  }

  const email = (body.email || '').trim().toLowerCase()
  const password = body.password || ''
  const displayName = (body.displayName || '').trim()

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Укажите корректный email.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Пароль должен быть не короче 8 символов.' }, { status: 400 })
  }

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Резолвим тенант по домену: active + domainVerified.
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
  const tenant = tenantsRes.docs[0] as any
  if (!tenant) {
    return NextResponse.json(
      { error: 'Не удалось определить сайт (домен не распознан).' },
      { status: 400 },
    )
  }
  const tenantId = tenant.id

  // Занятый email в пределах тенанта.
  const existing = await payload.find({
    collection: 'subscribers',
    where: {
      and: [{ tenant: { equals: tenantId } }, { email: { equals: email } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    return NextResponse.json({ error: 'Аккаунт с таким email уже существует.' }, { status: 409 })
  }

  try {
    await payload.create({
      collection: 'subscribers',
      data: {
        email,
        password,
        displayName: displayName || undefined,
        tenant: tenantId,
      } as any,
      overrideAccess: true,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Ошибка регистрации.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
