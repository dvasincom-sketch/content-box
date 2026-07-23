import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import { randomBytes } from 'crypto'
import config from '@/payload.config'
import {
  RESERVED_SUBDOMAINS,
  isValidSubdomain,
  domainFromSubdomain,
} from '@/lib/subdomain'

/**
 * Регистрация АВТОРА (владельца тенанта). Отдельный поток от регистрации
 * подписчиков (/api/register-subscriber). См. claude/onboarding-implementation-plan.md.
 *
 * Тело: { email, name? }
 * Пароль НЕ приходит от клиента — генерируется здесь и возвращается ОДИН РАЗ
 * в ответе (показывается на экране; позже продублируем письмом, когда будет SMTP).
 * Название проекта и адрес спрашиваем позже в мастере онбординга, поэтому тенант
 * создаётся с временным именем и случайным поддоменом.
 *
 * Действия (Local API, overrideAccess — tenants.create=superAdminOnly обходим):
 *   1. Валидация; уникальность email в users.
 *   2. Временный свободный поддомен (наш wildcard → сразу verified+active).
 *   3. tenant (name-плейсхолдер) → user (editor, сгенерированный пароль) → site-settings.
 * Частичный сбой откатывается вручную.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TENANT_NAME_PLACEHOLDER = 'Новый проект'
const MAX_SUBDOMAIN_TRIES = 50

// Читаемый пароль: без похожих символов (0/O, 1/l/I).
const PW_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generatePassword(len = 12): string {
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += PW_ALPHABET[bytes[i] % PW_ALPHABET.length]
  return out
}

// Короткий случайный поддомен-плейсхолдер (реальный адрес выберут в онбординге).
function randomSubBase(): string {
  return 'p' + randomBytes(5).toString('hex').slice(0, 8)
}

async function findFreeSubdomain(payload: Payload, base: string): Promise<string | null> {
  const root = base && base.length >= 3 ? base.slice(0, 27) : randomSubBase()
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
  let body: { email?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос.' }, { status: 400 })
  }

  const email = (body.email || '').trim().toLowerCase()
  const name = (body.name || '').trim()

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Укажите корректный email.' }, { status: 400 })
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

  const subdomain = await findFreeSubdomain(payload, randomSubBase())
  if (!subdomain) {
    return NextResponse.json({ error: 'Не удалось создать проект. Попробуйте ещё раз.' }, { status: 500 })
  }

  const password = generatePassword()

  // Тенант с временным именем — реальное название и адрес зададут в онбординге.
  let tenantId: number | string
  try {
    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: TENANT_NAME_PLACEHOLDER,
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

  // Пользователь-автор с сгенерированным паролем; при сбое откат тенанта.
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

  // Пустой site-settings; при сбое откат user + tenant.
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

  // TODO(email): когда подключим SMTP — отправлять письмо с email+паролем и
  // данными проекта. Сейчас пароль возвращается для одноразового показа на экране.
  return NextResponse.json({ ok: true, email, password })
}
