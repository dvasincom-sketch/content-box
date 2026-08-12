import type { Payload } from 'payload'
import { issueCode } from './otpStore'
import { codeEmail } from '@/emails/codeEmail'

/**
 * Выдать и отправить 6-значный код на e-mail (переиспользует otpStore: scope +
 * email как идентификатор). purpose управляет текстом письма.
 */
export async function sendEmailCode(
  payload: Payload,
  scope: string,
  email: string,
  purpose: 'verify' | 'link',
): Promise<{ ok: true } | { ok: false; error: string; retryAfterSec?: number }> {
  const issued = issueCode(scope, email, payload.secret)
  if (!issued.ok) {
    return {
      ok: false,
      error: issued.reason === 'cooldown' ? 'Код уже отправлен, повторите позже.' : 'Слишком много запросов, попробуйте позже.',
      retryAfterSec: issued.retryAfterSec,
    }
  }
  try {
    const mail = codeEmail(issued.code, purpose)
    await payload.sendEmail({ to: email, subject: mail.subject, html: mail.html })
  } catch {
    return { ok: false, error: 'Не удалось отправить письмо. Попробуйте позже.' }
  }
  return { ok: true }
}
