import { withSubscriber, apiError, apiOk, readJson } from '@/app/(frontend)/account/api/_lib'
import { isSyntheticEmail } from '@/lib/authEmail'
import { emailBrandForTenant } from '@/emails'
import { newEmailVerifyToken, subscriberVerifyMail, EMAIL_VERIFY_TTL_MS } from '@/emails/verify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Задать/сменить реальный email подписчика (в т.ч. телефонного, у которого email
 * синтетический) и отправить письмо-подтверждение со ссылкой `/verify-email?token=`.
 *
 * Body: { email }
 *  - валидация формата; запрет синтетических адресов;
 *  - дедуп в рамках тенанта (409, если занят другим подписчиком);
 *  - запись email + emailVerified=false + токен; письмо-подтверждение (best-effort).
 *
 * Повторный POST того же адреса перевыпускает токен и шлёт письмо заново
 * («отправить ещё раз»).
 */
export const POST = withSubscriber(async ({ req, subscriber, payload, tenantId }) => {
  const data = await readJson<{ email?: string }>(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const email = String(data.email || '').trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return apiError('Укажите корректный email')
  if (email.length > 200) return apiError('Слишком длинный email')
  if (isSyntheticEmail(email)) return apiError('Укажите настоящий почтовый адрес')
  if (tenantId == null) return apiError('Не удалось определить сайт', 400)

  // Уже стоит этот же подтверждённый адрес — незачем что-то менять.
  const currentEmail = String((subscriber as { email?: string }).email || '').toLowerCase()
  const alreadyVerified = Boolean((subscriber as { emailVerified?: boolean }).emailVerified)
  if (email === currentEmail && alreadyVerified) {
    return apiOk({ email, emailVerified: true, unchanged: true })
  }

  // Дедуп в рамках тенанта: адрес не должен принадлежать другому подписчику.
  const clash = await payload.find({
    collection: 'subscribers',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { email: { equals: email } },
        { id: { not_equals: subscriber.id } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (clash.docs.length > 0) {
    return apiError('Этот email уже используется другим аккаунтом на сайте.', 409)
  }

  const token = newEmailVerifyToken()
  const expiry = new Date(Date.now() + EMAIL_VERIFY_TTL_MS).toISOString()

  try {
    await payload.update({
      collection: 'subscribers',
      id: subscriber.id,
      data: {
        email,
        emailVerified: false,
        emailVerifyToken: token,
        emailVerifyExpiry: expiry,
      } as never,
      overrideAccess: true,
    })
  } catch (e) {
    return apiError((e as Error).message || 'Не удалось сохранить email', 400)
  }

  // Письмо-подтверждение в бренде тенанта. Сбой почты не критичен: адрес уже
  // сохранён, можно переотправить кнопкой «отправить ещё раз».
  let mailSent = false
  try {
    const tenant = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }).catch(() => null)
    const settingsRes = await payload.find({ collection: 'site-settings', where: { tenant: { equals: tenantId } }, depth: 1, limit: 1, overrideAccess: true })
    const domain = (tenant as { domain?: string } | null)?.domain
    if (tenant && domain) {
      const brand = emailBrandForTenant(tenant as any, settingsRes.docs[0])
      const mail = subscriberVerifyMail({
        brand,
        tenantDomain: domain,
        token,
        displayName: (subscriber as { displayName?: string }).displayName ?? null,
      })
      await payload.sendEmail({ to: email, subject: mail.subject, html: mail.html })
      mailSent = true
    }
  } catch {
    // почта не критична
  }

  return apiOk({ email, emailVerified: false, mailSent })
})
