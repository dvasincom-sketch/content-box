import { withAuthor, apiOk } from '../../_lib'

/**
 * Пополнение депозита на ИИ — ЗАГЛУШКА. Приём платежей (YooKassa) ещё не подключён,
 * поэтому автор НЕ может задать депозит сам: роут ничего не пишет. Депозит
 * зачисляется через оплату (позже) или вручную суперадмином в админке
 * (site-settings.aiDepositRub; поле закрыто на update для всех, кроме суперадмина).
 *  POST → { ok, pending, message }
 */
export const runtime = 'nodejs'

export const POST = withAuthor(async () => {
  return apiOk({ pending: true, message: 'Пополнение депозита через оплату появится вместе с биллингом.' })
})
