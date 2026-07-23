import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@/payload.config'
import { slugify } from '@/lib/slugify'
import {
  RESERVED_SUBDOMAINS,
  isValidSubdomain,
  domainFromSubdomain,
} from '@/lib/subdomain'

/**
 * Регистрация АВТОРА (владельца тенанта). Отдельный поток от регистрации
 * подписчиков (/api/register-subscriber). См. claude/onboarding-implementation-plan.md.
 *
 * Тело: { email, password, name, projectName }
 * Действия (Local API, overrideAccess — tenants.create=superAdminOnly обходим):
 *   1. Валидация; уникальность email в users.
 *   2. Синтез свободного поддомена из названия проекта.
 *   3. Создание tenant (subdomain — наш wildcard-домен, потому сразу
 *      domainVerified=true + status=active, чтобы публичный сайт резолвился).
 *   4. Создание user (tenant, tenantRole=editor).
 *   5. Пустой site-settings (студийные настройки читают запись по тенанту).
 * Частичный сбой откатывается вручную (это отдельные вызовы, не транзакция).
 *
 * Почта-подтверждение — отложена (решение заказчика). Здесь не отправляется.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8
const MAX_SUBDOMAIN_TRIES = 50

/** Ищет свободный поддомен: base, base-2, base-3, … пропуская reserved/занятые. */
async function findFreeSubdomain(payload: Payload, base: string): Promise<string | null> {
  const root = base && base.length >= 3 ? base.slice(0, 27) : 'studio'
  for (let i = 0; i < MAX_SUBDOMAIN_TRIES; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`
    if (!isValidSubdomain(candidate) || RESERVED_SUBDOMAINS.has(candidate)) continue
    const taken = await payload.find({
      collection: 'tenants',
      where: { subdomain: { equals: candidate } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (taken.docs.length === 0) return candidate
  }
  return null
}

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; name?: string; projectName?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос.' }, { status: 400 })
  }

  const email = (body.email || '').trim().toLowerCase()
  const password = body.password || ''
  const name = (body.name || '').trim()
  const projectName = (body.projectName || '').trim()

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Укажите корректный email.' }, { status: 400 })
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Пароль должен быть не короче ${MIN_PASSWORD} символов.` },
      { status: 400 },
    )
  }
  if (!projectName) {
    return NextResponse.json({ error: 'Укажите название проекта.' }, { status: 400 })
  }

  const payload = await getPayload({ config: await config })

  // Email уникален глобально (auth-коллекция users). Чистый 409 до создания.
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    return NextResponse.json(
      { error: 'Пользователь с таким email уже существует.' },
      { status: 409 },
    )
  }

  // Свободный поддомен из названия проекта.
  const base = slugify(projectName).slice(0, 27)
  const subdomain = await findFreeSubdomain(payload, base)
  if (!subdomain) {
    return NextResponse.json(
      { error: 'Не удалось подобрать свободный адрес. Попробуйте другое название.' },
      { status: 409 },
    )
  }

  // Создаём тенант. subdomain под нашим wildcard — считаем домен подтверждённым.
  let tenantId: number | string
  try {
    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: projectName,
        subdomain,
        domain: domainFromSubdomain(subdomain),
        domainVerified: true,
        status: 'active',
        onboardingStep: 0,
        onboardingComplete: false,
      } as any,
      overrideAccess: true,
    })
    tenantId = tenant.id
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || 'Не удалось создать проект.' },
      { status: 400 },
    )
  }

  // Создаём пользователя-автора; при сбое откатываем тенант.
  let userId: number | string
  try {
    const user = await payload.create({
      collection: 'users',
      data: {
        email,
        password,
        name: name || undefined,
        tenant: tenantId,
        tenantRole: 'editor',
      } as any,
      overrideAccess: true,
    })
    userId = user.id
  } catch (e) {
    await payload.delete({ collection: 'tenants', id: tenantId, overrideAccess: true }).catch(() => {})
    const msg = /email/i.test((e as Error).message || '')
      ? 'Пользователь с таким email уже существует.'
      : (e as Error).message || 'Не удалось создать аккаунт.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Пустой site-settings для тенанта; при сбое откатываем user + tenant.
  try {
    await payload.create({
      collection: 'site-settings',
      data: { tenant: tenantId } as any,
      overrideAccess: true,
    })
  } catch {
    await payload.delete({ collection: 'users', id: userId, overrideAccess: true }).catch(() => {})
    await payload.delete({ collection: 'tenants', id: tenantId, overrideAccess: true }).catch(() => {})
    return NextResponse.json(
      { error: 'Не удалось инициализировать проект. Попробуйте ещё раз.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, subdomain, domain: domainFromSubdomain(subdomain) })
}
