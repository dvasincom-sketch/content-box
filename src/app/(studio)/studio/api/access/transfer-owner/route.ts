import { withAuthor, readJson, apiOk, apiError, isContributor } from '@/app/(studio)/studio/api/_lib'
import { issueCode, verifyCode } from '@/lib/otpStore'
import { setPendingTransfer, getPendingTransfer, clearPendingTransfer } from '@/lib/ownerTransfer'
import { ownerTransferCodeEmail, ownerTransferDoneEmail } from '@/emails/templates'
import { logActivity } from '@/lib/logActivity'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Передача прав владельца проекта другому участнику — двухшаговый, с
 * подтверждением кодом на email текущего владельца (безопасность).
 *  action='request'  { targetUserId } → шлём код на почту владельца
 *  action='confirm'  { code }        → меняем роли: цель → владелец (editor/owner),
 *                                       текущий → администратор (admin)
 * Доступно только владельцу студии (не участнику). Секрет для OTP — payload.secret.
 */
export const runtime = 'nodejs'

function maskEmail(e: string): string {
  const [u, d] = e.split('@')
  if (!d) return e
  return `${u.slice(0, 2)}***@${d}`
}
function originOf(req: Request): string {
  const fwdHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  const isLocal = fwdHost.startsWith('localhost') || fwdHost.startsWith('127.0.0.1')
  const proto = req.headers.get('x-forwarded-proto') ?? (isLocal ? 'http' : 'https')
  return `${proto}://${fwdHost}`
}

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')
  const action = String((data as any).action || '')
  const ownerId = String(author.user.id)
  const ownerEmail = String((author.user as any).email || '')

  async function loadTarget(targetId: string): Promise<any | null> {
    if (!targetId) return null
    const u: any = await payload.findByID({ collection: 'users', id: targetId, depth: 0, overrideAccess: true }).catch(() => null)
    if (!u) return null
    const ut = u.tenant && typeof u.tenant === 'object' ? u.tenant.id : u.tenant
    if (Number(ut) !== Number(tenantId)) return null
    if (u.platformRole === 'superadmin') return null
    if (u.disabled) return null
    if (String(u.id) === ownerId) return null
    return u
  }

  if (action === 'request') {
    const target = await loadTarget(String((data as any).targetUserId || ''))
    if (!target) return apiError('Выберите активного участника проекта')
    if (!ownerEmail) return apiError('У вашего аккаунта нет email для подтверждения передачи')

    // Почтовый адаптер (RuSender) включается в payload.config ТОЛЬКО при наличии
    // RUSENDER_API_TOKEN. Если его нет в рантайме — payload.sendEmail молча ничего
    // не отправит, а сценарий рапортовал бы «код отправлен». Проверяем явно.
    const smtpReady = !!(process.env.SMTP_HOST || '').trim()
    const apiReady = !!(process.env.RUSENDER_API_TOKEN || '').trim() && !!(process.env.RUSENDER_API_KEY_ID || '').trim()
    if (!smtpReady && !apiReady) {
      return apiError('Отправка писем на сервере не настроена — код подтверждения выслать нельзя. Сообщите администратору платформы (SMTP_HOST для SMTP, либо RUSENDER_API_TOKEN + RUSENDER_API_KEY_ID для API).', 503)
    }

    const issued = issueCode(String(tenantId), `owner-transfer:${ownerId}`, payload.secret)
    if (!issued.ok) {
      return apiError(issued.reason === 'cooldown' ? `Код уже отправлен. Повторно можно через ${issued.retryAfterSec} с` : 'Слишком много попыток — попробуйте позже', 429)
    }
    setPendingTransfer(String(tenantId), ownerId, String(target.id))

    const tenant: any = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }).catch(() => null)
    const projectName = String(tenant?.name || 'проект')
    const targetName = String(target.name || target.email || 'участник')
    try {
      const mail = ownerTransferCodeEmail({ code: issued.code, projectName, targetName })
      await payload.sendEmail({ to: ownerEmail, subject: mail.subject, html: mail.html })
    } catch (e: unknown) {
      return apiError(errorMessage(e, 'Не удалось отправить письмо с кодом'), 500)
    }
    return apiOk({ sentTo: maskEmail(ownerEmail) })
  }

  if (action === 'confirm') {
    const code = String((data as any).code || '').trim()
    if (!/^\d{6}$/.test(code)) return apiError('Код — 6 цифр')
    const targetId = getPendingTransfer(String(tenantId), ownerId)
    if (!targetId) return apiError('Запрос устарел — начните передачу заново')
    const v = verifyCode(String(tenantId), `owner-transfer:${ownerId}`, code, payload.secret)
    if (v !== 'ok') {
      return apiError(v === 'expired' ? 'Код истёк — запросите новый' : v === 'too_many' ? 'Слишком много попыток — запросите новый код' : 'Неверный код', 400)
    }
    const target = await loadTarget(targetId)
    if (!target) { clearPendingTransfer(String(tenantId), ownerId); return apiError('Участник больше недоступен — начните заново') }

    await payload.update({ collection: 'users', id: target.id, data: { tenantRole: 'editor', studioRole: 'owner' } as any, overrideAccess: true })
    await payload.update({ collection: 'users', id: ownerId, data: { tenantRole: 'admin', studioRole: 'admin' } as any, overrideAccess: true })
    clearPendingTransfer(String(tenantId), ownerId)

    try { await logActivity(payload, { tenant: tenantId, user: ownerId, action: 'update', entity: 'access', title: `Передал права владельца: ${target.name || target.email}` }) } catch { /* лог не критичен */ }
    try {
      const tenant: any = await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true }).catch(() => null)
      const projectName = String(tenant?.name || 'проект')
      if (target.email) {
        const done = ownerTransferDoneEmail({ projectName, studioUrl: `${originOf(req)}/studio` })
        await payload.sendEmail({ to: target.email, subject: done.subject, html: done.html })
      }
    } catch { /* уведомление не критично */ }

    return apiOk({ newOwnerId: String(target.id) })
  }

  return apiError('Неизвестное действие')
})

/**
 * Диагностика отправки писем (только владельцу студии): настроен ли RuSender в
 * рантайме и есть ли email у владельца. Значения секретов НЕ раскрываются — только
 * факт наличия. Имена похожих env отдаём, чтобы поймать опечатку/кириллицу в имени.
 */
export const GET = withAuthor(async ({ author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const hasToken = !!(process.env.RUSENDER_API_TOKEN || '').trim()
  const hasKeyId = !!(process.env.RUSENDER_API_KEY_ID || '').trim()
  const smtpHost = (process.env.SMTP_HOST || '').trim()
  const smtpReady = !!smtpHost
  const apiReady = hasToken && hasKeyId
  const fromAddress = (process.env.EMAIL_FROM_ADDRESS || '').trim()
  return apiOk({
    emailConfigured: smtpReady || apiReady,
    transport: smtpReady ? 'smtp' : apiReady ? 'rusender-api' : 'none',
    smtp: { host: smtpHost, portSet: !!(process.env.SMTP_PORT || '').trim(), userSet: !!(process.env.SMTP_USER || '').trim(), passSet: !!(process.env.SMTP_PASS || '').trim() },
    hasToken,
    hasKeyId,
    fromAddressSet: !!fromAddress,
    fromAddressHost: fromAddress.includes('@') ? fromAddress.split('@')[1] : '',
    ownerHasEmail: !!String((author.user as { email?: unknown }).email || '').trim(),
    mailEnvKeys: Object.keys(process.env)
      .filter((k) => /rusender|email_from|email_reply|smtp/i.test(k))
      .map((k) => ({ name: k, ascii: /^[\x20-\x7E]+$/.test(k) })),
  })
})
