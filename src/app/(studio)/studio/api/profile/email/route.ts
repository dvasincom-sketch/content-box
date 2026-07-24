import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Смена собственного email (= логина). Чувствительно: подтверждаем текущим
 * паролем. Меняем только аккаунт из сессии.
 *
 * Body: { newEmail, password }
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const POST = withAuthor(async ({ req, payload, author }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const newEmail = String(data.newEmail || '').trim().toLowerCase()
  const password = String(data.password || '')

  if (!EMAIL_RE.test(newEmail)) {
    return apiError('Некорректный email')
  }
  if (!password) {
    return apiError('Введите пароль для подтверждения')
  }
  if (newEmail === author.user.email.toLowerCase()) {
    return apiError('Это ваш текущий email')
  }

  // Подтверждаем паролем
  try {
    await payload.login({
      collection: 'users',
      data: { email: author.user.email, password },
    })
  } catch {
    return apiError('Пароль неверный')
  }

  // Email занят?
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: newEmail } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.totalDocs > 0) {
    return apiError('Этот email уже используется', 409)
  }

  try {
    await payload.update({
      collection: 'users',
      id: author.user.id,
      data: { email: newEmail } as any,
      overrideAccess: true,
    })
    return apiOk({ email: newEmail })
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось сменить email')
  }
})
