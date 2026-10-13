import { withAuthor, readJson, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'
import { isSyntheticEmail } from '@/lib/authEmail'
import { sendSubscriptionNoticeTest, emailTransport } from '@/lib/subscriptionNotices'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Тестовая отправка писем об окончании подписки — кнопка в панели «Платных»
 * на дашборде. Шлёт ОБА вида («через 3 дня» и «закончилась») с пометкой
 * [ТЕСТ] в бренде проекта. Только владелец. Подписчикам ничего не уходит.
 *
 * Body (опц.): { to } — адрес; по умолчанию email владельца студии.
 * Ответ: { to, transport, from, results: [{ subject, messageId, accepted,
 * rejected, response }] } — что ответил почтовый сервер, для диагностики.
 */
export const runtime = 'nodejs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = ((await readJson(req)) ?? {}) as { to?: unknown }
  const ownerEmail = String((author.user as { email?: string }).email || '')
  const to = (typeof data.to === 'string' && data.to.trim()) || ownerEmail
  if (!to || isSyntheticEmail(to)) {
    return apiError('Укажите адрес для теста — у вашего аккаунта нет email', 400)
  }
  if (!EMAIL_RE.test(to)) return apiError('Некорректный email')

  const transport = emailTransport()
  const from = process.env.EMAIL_FROM_ADDRESS || 'noreply@contentbox.site'
  try {
    const results = await sendSubscriptionNoticeTest(payload, tenantId, to)
    return apiOk({ to, transport, from, results })
  } catch (e) {
    // Ошибка SMTP (неверный логин, отклонён отправитель и т.п.) — показываем как есть.
    return apiError(`${errorMessage(e, 'Не удалось отправить письма')} (транспорт: ${transport})`, 500)
  }
})
