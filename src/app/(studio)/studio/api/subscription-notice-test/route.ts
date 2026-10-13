import { withAuthor, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'
import { isSyntheticEmail } from '@/lib/authEmail'
import { sendSubscriptionNoticeTest } from '@/lib/subscriptionNotices'

/**
 * Тестовая отправка писем об окончании подписки — кнопка в панели «Платных»
 * на дашборде. Шлёт ОБА вида («через 3 дня» и «закончилась») с пометкой
 * [ТЕСТ] на email владельца студии, в бренде его проекта. Только владелец.
 * Подписчикам ничего не уходит, отметки не ставятся.
 */
export const runtime = 'nodejs'

export const POST = withAuthor(async ({ payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const to = String((author.user as { email?: string }).email || '')
  if (!to || isSyntheticEmail(to)) {
    return apiError('У вашего аккаунта не указан email — добавьте его в профиле студии', 400)
  }
  try {
    const sent = await sendSubscriptionNoticeTest(payload, tenantId, to)
    return apiOk({ to, sent })
  } catch (e) {
    return apiError(e instanceof Error ? e.message : 'Не удалось отправить письма', 500)
  }
})
