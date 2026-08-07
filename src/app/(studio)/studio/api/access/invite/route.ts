import crypto from 'crypto'
import { withAuthor, readJson, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'
import { logActivity } from '@/lib/logActivity'
import { errorMessage } from '@/lib/errorMessage'
import { PRESETS, normalize, ASSIGNABLE_PRESETS } from '@/lib/permissions'

/**
 * Пригласить участника (роль contributor). Только владелец студии (не участник).
 *
 * Поведение по email:
 *  - НОВЫЙ email → создаём users-запись со случайным паролем и одноразовым
 *    токеном; сырой токен возвращается ОДИН раз в ссылке (в БД только sha256).
 *  - СУЩЕСТВУЮЩИЙ email и это приглашённый участник ЭТОГО тенанта (в т.ч.
 *    отключённый или с истёкшим приглашением) → РЕАКТИВАЦИЯ: снимаем disabled,
 *    выдаём свежий токен/срок, сбрасываем приём приглашения — владелец получает
 *    новую рабочую ссылку. Так «снова добавить» отключённого помощника работает.
 *  - СУЩЕСТВУЮЩИЙ email из другого тенанта / владелец / не-contributor →
 *    ошибка «уже существует» (нельзя перехватить чужой аккаунт).
 *
 * Письмо не шлём — владелец копирует ссылку и передаёт вручную.
 * Body: { email, name? }  Ответ: { ok, inviteUrl, email, expiresAt, reactivated? }
 */
export const runtime = 'nodejs'

const INVITE_TTL_DAYS = 7

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const email = String(data.email || '').trim().toLowerCase()
  const name = String(data.name || '').trim()
  const roleRaw = String((data as { studioRole?: unknown }).studioRole || 'author')
  const role = (ASSIGNABLE_PRESETS as readonly string[]).includes(roleRaw) ? roleRaw : 'author'
  const caps = normalize(PRESETS[role] ?? {})
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return apiError('Укажите корректный email')

  // Свежие токен/срок готовим заранее — пригодятся и для создания, и для реактивации.
  const raw = crypto.randomBytes(32).toString('hex')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
  // Публичный origin берём из forwarded-заголовков (за прокси Timeweb req.url —
  // внутренний localhost). Совпадает с логикой proxy.ts.
  const fwdHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const host = fwdHost ?? new URL(req.url).host
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  const proto = req.headers.get('x-forwarded-proto') ?? (isLocal ? 'http' : 'https')
  const origin = `${proto}://${host}`
  const inviteUrl = `${origin}/studio/invite/${raw}`

  const existing = await payload.find({
    collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    const u: any = existing.docs[0]
    const uTenant = u.tenant && typeof u.tenant === 'object' ? u.tenant.id : u.tenant
    const sameTenant = Number(uTenant) === Number(tenantId)
    // Реактивировать можно только приглашённого участника этого тенанта.
    if (!sameTenant || u.tenantRole !== 'contributor') {
      return apiError('Пользователь с таким email уже существует')
    }
    try {
      await payload.update({
        collection: 'users',
        id: u.id,
        overrideAccess: true,
        data: {
          disabled: false,
          inviteTokenHash: hash,
          inviteExpiresAt: expiresAt,
          inviteAcceptedAt: null,
          studioRole: role,
          capabilities: caps,
          ...(name ? { name } : {}),
        } as any,
      })
    } catch (e: unknown) {
      return apiError(errorMessage(e, 'Не удалось обновить приглашение'), 500)
    }
    await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'invite', entity: 'участника', title: email })
    return apiOk({ inviteUrl, email, expiresAt, reactivated: true })
  }

  try {
    await payload.create({
      collection: 'users',
      data: {
        email,
        name: name || undefined,
        tenant: tenantId,
        tenantRole: 'contributor',
        studioRole: role,
        capabilities: caps,
        password: crypto.randomBytes(24).toString('hex'),
        inviteTokenHash: hash,
        inviteExpiresAt: expiresAt,
        invitedBy: author.user.id,
      } as any,
      overrideAccess: true,
    })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось создать приглашение'), 500)
  }

  await logActivity(payload, { tenant: tenantId, user: author.user.id, action: 'invite', entity: 'участника', title: email })
  return apiOk({ inviteUrl, email, expiresAt })
})
