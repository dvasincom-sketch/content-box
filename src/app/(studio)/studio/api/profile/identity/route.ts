import { withAuthor, apiOk, apiError, readJson } from '@/app/(studio)/studio/api/_lib'
import { isSyntheticEmail } from '@/lib/authEmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Установка/смена имени и e-mail автора БЕЗ пароля. Нужен телефонным авторам:
 * пароль у них случайный, а обычная смена e-mail (profile/email) требует пароль.
 *
 * Тело: { name?, email? }.
 * - name — задаётся всегда (пустое → сбрасываем в null).
 * - email — сменить без пароля можно только телефонному автору (phone+verified)
 *   или пока текущий e-mail синтетический; иначе смена почты идёт через
 *   profile/email. При смене ставим emailVerified=false (подтверждение отдельно,
 *   доступ не блокирует).
 */
export const POST = withAuthor(async ({ req, author, payload }) => {
  const body = await readJson<{ name?: string; email?: string }>(req)
  if (body === undefined) return apiError('Некорректный запрос')
  const user = author.user as {
    id: string | number
    email?: string | null
    phone?: string | null
    phoneVerified?: boolean | null
  }

  const data: Record<string, unknown> = {}

  const name = typeof body.name === 'string' ? body.name.trim() : undefined
  if (name !== undefined) data.name = name || null

  const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined
  if (emailRaw !== undefined && emailRaw !== '') {
    if (!EMAIL_RE.test(emailRaw)) return apiError('Некорректный e-mail')
    const current = String(user.email || '').toLowerCase()
    if (emailRaw !== current) {
      const isPhoneAuthor = Boolean(user.phone && user.phoneVerified)
      const currentIsSynthetic = isSyntheticEmail(current)
      if (!isPhoneAuthor && !currentIsSynthetic) {
        return apiError('Смену e-mail подтвердите паролем в блоке «Смена email».', 403)
      }
      const dup = await payload.find({ collection: 'users', where: { email: { equals: emailRaw } }, limit: 1, depth: 0, overrideAccess: true })
      if (dup.docs.length && String(dup.docs[0].id) !== String(user.id)) {
        return apiError('Этот e-mail уже используется другим аккаунтом.', 409)
      }
      data.email = emailRaw
      data.emailVerified = false
    }
  }

  if (Object.keys(data).length === 0) return apiOk({ noop: true })
  try {
    await payload.update({ collection: 'users', id: user.id, data, overrideAccess: true })
  } catch (e) {
    return apiError((e as Error).message || 'Не удалось сохранить', 400)
  }
  return apiOk()
})
