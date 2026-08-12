import { withAuthor, apiOk, apiError } from '@/app/(studio)/studio/api/_lib'
import { isSyntheticEmail } from '@/lib/authEmail'
import { sendEmailCode } from '@/lib/emailOtp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Отправить код подтверждения на СВОЙ e-mail (из профиля). */
export const POST = withAuthor(async ({ author, payload }) => {
  const user = author.user as { email?: string | null; emailVerified?: boolean | null }
  const email = String(user.email || '').toLowerCase()
  if (!email || isSyntheticEmail(email)) return apiError('Сначала укажите e-mail.')
  if (user.emailVerified) return apiOk({ already: true })
  const sent = await sendEmailCode(payload, 'author-email', email, 'verify')
  if (!sent.ok) return apiError(sent.error, 502)
  return apiOk()
})
