import crypto from 'crypto'
import { withAuthor, readJson, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Пригласить участника (роль contributor). Только владелец студии (не участник).
 * Создаёт users-запись с случайным паролем и одноразовым токеном; сырой токен
 * возвращается ОДИН раз в ссылке (в БД только его sha256). Письмо не шлём —
 * владелец копирует ссылку и передаёт вручную.
 *
 * Body: { email, name? }  Ответ: { ok, inviteUrl, email, expiresAt }
 */
export const runtime = 'nodejs'

const INVITE_TTL_DAYS = 7

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const email = String(data.email || '').trim().toLowerCase()
  const name = String(data.name || '').trim()
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return apiError('Укажите корректный email')

  const existing = await payload.find({
    collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true,
  })
  if (existing.docs.length > 0) return apiError('Пользователь с таким email уже существует')

  const raw = crypto.randomBytes(32).toString('hex')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  try {
    await payload.create({
      collection: 'users',
      data: {
        email,
        name: name || undefined,
        tenant: tenantId,
        tenantRole: 'contributor',
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

  const origin = new URL(req.url).origin
  return apiOk({ inviteUrl: `${origin}/studio/invite/${raw}`, email, expiresAt })
})
