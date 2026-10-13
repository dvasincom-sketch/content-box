import { renderLayout, esc, type EmailBrand } from './layout'
import type { RenderedEmail } from './templates'

/**
 * Письма об окончании платной подписки (референс — Boosty «Через 3 дня мы
 * продлим вашу подписку»): центрированная карточка — аватар и имя автора,
 * «ТИП ПОДПИСКИ», название тарифа, цена, крупная кнопка, строка про кабинет.
 *
 *  - kind 'reminder' — за N дней до окончания (по умолчанию 3).
 *      autoRenew=true  → «Через 3 дня мы продлим вашу подписку» (спишем с карты);
 *      autoRenew=false → «Через 3 дня закончится ваша подписка» + «Продлить».
 *  - kind 'expired'  — подписка закончилась, доступ закрыт → «Продлить подписку».
 */

export type SubscriptionNoticeKind = 'reminder' | 'expired'

export function subscriptionNoticeEmail(params: {
  brand: EmailBrand
  kind: SubscriptionNoticeKind
  /** Имя автора/проекта под аватаром. */
  authorName: string
  /** Круглый аватар автора (иконка приложения/лого). Нет — буква-заглушка. */
  avatarUrl?: string | null
  tierName: string
  priceRub?: number | null
  /** Дата окончания (ISO) — для текста. */
  until: string
  /** Сколько дней осталось (для reminder). */
  daysLeft?: number
  /** Подписка продлится сама (сохранённая карта ЮKassa). */
  autoRenew?: boolean
  /** Кнопка: страница оформления с выбранным тарифом. */
  renewUrl: string
  /** Кабинет подписки (отмена/управление). */
  accountUrl: string
  /** Обращение по имени. */
  name?: string | null
}): RenderedEmail {
  const { brand, kind, authorName, avatarUrl, tierName, priceRub, until, autoRenew, renewUrl, accountUrl, name } = params
  const accent = brand.color || '#7C3AED'
  const days = Math.max(1, params.daysLeft ?? 3)
  const daysWord = pluralDays(days)
  const untilText = new Date(until).toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: 'numeric',
    month: 'long',
  })

  let heading: string
  let lead: string
  let ctaLabel: string
  let ctaUrl: string
  let note: string

  if (kind === 'expired') {
    heading = 'Ваша подписка закончилась'
    lead = `Срок подписки истёк ${esc(untilText)}, доступ к материалам по подписке закрыт. Продлите её, чтобы снова смотреть и читать всё, что выходит у автора.`
    ctaLabel = 'Продлить подписку'
    ctaUrl = renewUrl
    note = `Подписку можно оформить заново в любой момент на <a href="${esc(accountUrl)}" target="_blank" style="color:${accent}; text-decoration:none;">странице подписки</a>.`
  } else if (autoRenew) {
    heading = `Через ${days} ${daysWord} мы продлим вашу подписку`
    lead = `${esc(untilText)} спишем оплату за следующий период с сохранённой карты — доступ не прервётся.`
    ctaLabel = 'Перейти на страницу автора'
    ctaUrl = brand.siteUrl || renewUrl
    note = `Вы можете отменить подписку в <a href="${esc(accountUrl)}" target="_blank" style="color:${accent}; text-decoration:none;">настройках аккаунта</a>.`
  } else {
    heading = `Через ${days} ${daysWord} закончится ваша подписка`
    lead = `Подписка действует до ${esc(untilText)}. Продлите её заранее, чтобы доступ к материалам не прервался.`
    ctaLabel = 'Продлить подписку'
    ctaUrl = renewUrl
    note = `Управлять подпиской можно в <a href="${esc(accountUrl)}" target="_blank" style="color:${accent}; text-decoration:none;">настройках аккаунта</a>.`
  }

  const initial = esc((authorName || '?').trim().slice(0, 1).toUpperCase())
  const avatar = avatarUrl
    ? `<img src="${esc(avatarUrl)}" alt="${esc(authorName)}" width="88" height="88" style="display:block; margin:0 auto; width:88px; height:88px; border-radius:50%; object-fit:cover; border:0;">`
    : `<div style="margin:0 auto; width:88px; height:88px; line-height:88px; border-radius:50%; background:${accent}; color:#ffffff; font-size:34px; font-weight:700; text-align:center;">${initial}</div>`

  const price =
    priceRub && priceRub > 0
      ? `<p style="margin:0 0 22px; font-size:18px; font-weight:700; color:#18181b;">${esc(priceRub.toLocaleString('ru-RU'))} ₽ в месяц</p>`
      : ''

  const hello = name?.trim() ? `<p style="margin:0 0 18px; color:#3f3f46;">Здравствуйте, ${esc(name.trim())}!</p>` : ''

  // Центрированная карточка как в референсе; кнопка — во всю ширину блока.
  const bodyHtml = `
    <div style="text-align:center;">
      ${hello}
      ${avatar}
      <p style="margin:12px 0 22px; font-size:16px; color:#18181b;">${esc(authorName)}</p>
      <p style="margin:0 0 6px; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#a1a1aa;">Тип подписки</p>
      <p style="margin:0 0 14px; font-size:19px; color:#18181b;">${esc(tierName)}</p>
      ${price}
      <p style="margin:0 0 22px; color:#52525b;">${lead}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr>
          <td align="center" bgcolor="${accent}" style="border-radius:10px;">
            <a href="${esc(ctaUrl)}" target="_blank"
               style="display:block; padding:15px 20px; font-family:Arial, Helvetica, sans-serif; font-size:15px; font-weight:700; letter-spacing:.03em; text-transform:uppercase; color:#ffffff; text-decoration:none; border-radius:10px;">
              ${esc(ctaLabel)}
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0; font-size:14px; color:#71717a;">${note}</p>
    </div>`

  const subject =
    kind === 'expired'
      ? `Подписка закончилась · ${authorName}`
      : autoRenew
        ? `Через ${days} ${daysWord} мы продлим вашу подписку`
        : `Через ${days} ${daysWord} закончится подписка · ${authorName}`

  // В layout заголовок слева — скрываем его (hideHeading) и рисуем свой по центру.
  const visibleHeading = `<h1 style="margin:0 0 22px; font-family:Arial, Helvetica, sans-serif; font-size:22px; line-height:1.3; font-weight:700; color:#18181b; text-align:center;">${esc(heading)}</h1>`

  return {
    subject,
    html: renderLayout({
      brand,
      preheader: kind === 'expired' ? `Продлите подписку «${tierName}», чтобы вернуть доступ` : `Подписка «${tierName}» действует до ${untilText}`,
      heading,
      hideHeading: true,
      bodyHtml: visibleHeading + bodyHtml,
      footerNote: 'Это служебное письмо о вашей подписке — оно приходит, даже если вы отключили дайджест.',
    }),
  }
}

function pluralDays(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'день'
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня'
  return 'дней'
}
