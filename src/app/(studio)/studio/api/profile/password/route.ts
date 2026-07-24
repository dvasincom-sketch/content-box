import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'

/**
 * Смена собственного пароля. Меняем ТОЛЬКО аккаунт из сессии — id берём из
 * getCurrentAuthor, не из тела запроса (иначе можно было бы сменить чужой).
 *
 * Перед сменой проверяем текущий пароль через payload.login — так автор не
 * сможет сменить пароль по «забытой» открытой сессии без знания старого.
 *
 * Body: { currentPassword, newPassword }
 */
export const POST = withAuthor(async ({ req, payload, author }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const currentPassword = String(data.currentPassword || '')
  const newPassword = String(data.newPassword || '')

  if (!currentPassword || !newPassword) {
    return apiError('Заполните оба поля')
  }
  if (newPassword.length < 8) {
    return apiError('Новый пароль — минимум 8 символов')
  }
  if (newPassword === currentPassword) {
    return apiError('Новый пароль совпадает со старым')
  }

  const email = author.user.email

  // Проверка текущего пароля
  try {
    await payload.login({
      collection: 'users',
      data: { email, password: currentPassword },
    })
  } catch {
    return apiError('Текущий пароль неверный')
  }

  // Смена пароля своего аккаунта
  try {
    await payload.update({
      collection: 'users',
      id: author.user.id,
      data: { password: newPassword } as any,
      overrideAccess: true,
    })
    return apiOk()
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось сменить пароль')
  }
})
