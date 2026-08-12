import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'
import { normalizePhone, formatPhone } from '@/lib/phone'
import { verifyCode } from '@/lib/otpStore'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Привязка/смена номера телефона авторизованного автора. Код запрашивается через
 * /studio/api/auth/phone/request (mode='register' — телефон должен быть свободен),
 * здесь проверяем код и ставим phone на текущего автора. Scope OTP — 'studio'.
 *
 * Body: { phone, code }
 */
const SCOPE = 'studio'

export const POST = withAuthor(async ({ req, payload, author }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const phone = normalizePhone(String(data.phone || ''))
  const code = String(data.code || '').replace(/\D/g, '')
  if (!phone) return apiError('Укажите корректный номер телефона.')
  if (code.length < 4) return apiError('Введите код из SMS.')

  const result = verifyCode(SCOPE, phone, code, payload.secret)
  if (result !== 'ok') {
    const map: Record<string, string> = { invalid: 'Неверный код', expired: 'Код истёк, запросите новый', too_many: 'Слишком много попыток, запросите новый код' }
    return apiError(map[result] || 'Ошибка кода')
  }

  // Номер не должен принадлежать другому аккаунту.
  const dup = await payload.find({ collection: 'users', where: { phone: { equals: phone } }, limit: 1, depth: 0, overrideAccess: true })
  const other = (dup.docs as any[]).find((u) => String(u.id) !== String(author.user.id))
  if (other) return apiError('Этот номер уже используется другим аккаунтом', 409)

  try {
    await payload.update({ collection: 'users', id: author.user.id, data: { phone, phoneVerified: true } as any, overrideAccess: true })
    return apiOk({ phone: formatPhone(phone) })
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить телефон'))
  }
})
