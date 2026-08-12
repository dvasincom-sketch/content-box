import { withAuthor, apiOk, apiError, readJson } from '@/app/(studio)/studio/api/_lib'
import { verifyCode } from '@/lib/otpStore'
import { isSyntheticEmail } from '@/lib/authEmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Проверить код и пометить свой e-mail подтверждённым. */
export const POST = withAuthor(async ({ req, author, payload }) => {
  const body = await readJson<{ code?: string }>(req)
  if (body === undefined) return apiError('Некорректный запрос')
  const user = author.user as { id: string | number; email?: string | null }
  const email = String(user.email || '').toLowerCase()
  if (!email || isSyntheticEmail(email)) return apiError('Сначала укажите e-mail.')
  const code = String(body.code || '').replace(/\D/g, '')
  const vr = verifyCode('author-email', email, code, payload.secret)
  if (vr !== 'ok') {
    const map: Record<string, string> = { invalid: 'Неверный код', expired: 'Код истёк, запросите новый', too_many: 'Слишком много попыток' }
    return apiError(map[vr] || 'Ошибка кода')
  }
  await payload.update({ collection: 'users', id: user.id, data: { emailVerified: true } as never, overrideAccess: true })
  return apiOk()
})
