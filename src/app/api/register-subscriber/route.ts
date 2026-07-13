import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

/**
 * Регистрация подписчика с СЕРВЕРНОЙ привязкой тенанта.
 *
 * Почему не дефолтный POST /api/subscribers: тот позволил бы клиенту передать
 * любой tenant. Здесь tenant берётся ТОЛЬКО из заголовка x-tenant-id (его
 * ставит proxy.ts по домену запроса) и проставляется через Local API с
 * overrideAccess. Любой tenant из тела запроса игнорируется.
 *
 * Тело: { email, password, displayName? }
 * Ответ: { ok: true } | { error: string }
 */
export async function POST(req: NextRequest) {
  const tenantHeader = req.headers.get('x-tenant-id')
  const tenantId = tenantHeader ? Number(tenantHeader) : null

  if (!tenantId || Number.isNaN(tenantId)) {
    return NextResponse.json({ error: 'Не удалось определить сайт (тенант).' }, { status: 400 })
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

  // Базовая валидация.
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Укажите корректный email.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Пароль должен быть не короче 8 символов.' }, { status: 400 })
  }

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Проверка на занятый email В ПРЕДЕЛАХ тенанта.
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
    return NextResponse.json(
      { error: 'Аккаунт с таким email уже существует.' },
      { status: 409 },
    )
  }

  // Создаём подписчика. tenant — ТОЛЬКО серверный, из заголовка.
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
    const msg = (e as Error).message || 'Ошибка регистрации.'
    // Payload может вернуть ошибку уникальности email (глобальную).
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
