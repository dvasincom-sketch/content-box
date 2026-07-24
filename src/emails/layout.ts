/**
 * Базовый шаблон письма (email-safe HTML).
 *
 * Верстка под почтовые клиенты: таблицы, инлайновые стили, ширина 600px,
 * веб-безопасные шрифты. Светлая карточка на сером фоне, тёмный текст — не
 * инвертируется в «тёмных темах» mail.ru/Яндекс. Бренд задаётся параметрами
 * (name/color/logo), поэтому один layout годится и для платформы, и для
 * писем подписчикам от имени автора (white-label в контенте).
 */

export type EmailBrand = {
  /** Имя отправителя в шапке/футере (Content Box или имя автора). */
  name: string
  /** Акцентный цвет (кнопки/ссылки). По умолчанию фиолетовый бренда. */
  color?: string | null
  /** URL логотипа (если есть) — иначе текстовое имя. */
  logoUrl?: string | null
  /** Ссылка на сайт бренда (шапка/футер). */
  siteUrl?: string | null
  /** Адрес поддержки (футер). */
  supportEmail?: string | null
  /** Подпись/адрес в футере (юр. текст). */
  address?: string | null
}

/** Бренд платформы по умолчанию. */
export const PLATFORM_BRAND: EmailBrand = {
  name: 'Content Box',
  color: '#7C3AED',
  logoUrl: null,
  siteUrl: 'https://contentbox.site',
  supportEmail: 'support@contentbox.site',
  address: 'Content Box · платформа подписок для авторов',
}

/** Экранирование значений, попадающих в HTML. */
export function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type EmailButton = { label: string; url: string }

export type LayoutParams = {
  brand: EmailBrand
  /** Скрытый превью-текст (прехедер) — показывается в списке писем. */
  preheader?: string
  /** Заголовок письма (H1). */
  heading: string
  /** Готовый безопасный HTML тела (абзацы `<p>…`). */
  bodyHtml: string
  /** Основная кнопка-CTA (опционально). */
  cta?: EmailButton | null
  /** Доп. строка футера (например, про уведомления/отписку). */
  footerNote?: string | null
}

/** Bulletproof-кнопка на таблице (работает в Outlook). */
function button(btn: EmailButton, accent: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 8px 0 4px;">
    <tr>
      <td align="center" bgcolor="${accent}" style="border-radius: 10px;">
        <a href="${esc(btn.url)}" target="_blank"
           style="display: inline-block; padding: 13px 26px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px;">
          ${esc(btn.label)}
        </a>
      </td>
    </tr>
  </table>`
}

export function renderLayout({
  brand,
  preheader,
  heading,
  bodyHtml,
  cta,
  footerNote,
}: LayoutParams): string {
  const accent = brand.color || '#7C3AED'
  const brandName = esc(brand.name)
  const siteUrl = brand.siteUrl || '#'
  const header = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${brandName}" height="28" style="display:block; border:0; max-height:28px;">`
    : `<span style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 700; color: ${accent};">${brandName}</span>`

  const support = brand.supportEmail
    ? `<a href="mailto:${esc(brand.supportEmail)}" style="color:#71717a; text-decoration:underline;">${esc(brand.supportEmail)}</a>`
    : ''

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${esc(heading)}</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f5; -webkit-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#f4f4f5; font-size:1px; line-height:1px;">${esc(preheader || heading)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr>
      <td align="center" style="padding: 28px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%; max-width:600px;">
          <!-- header -->
          <tr>
            <td style="padding: 4px 8px 18px;">
              <a href="${esc(siteUrl)}" target="_blank" style="text-decoration:none;">${header}</a>
            </td>
          </tr>
          <!-- card -->
          <tr>
            <td style="background:#ffffff; border:1px solid #e4e4e7; border-radius:16px; padding: 32px 32px 28px;">
              <h1 style="margin:0 0 16px; font-family: Arial, Helvetica, sans-serif; font-size:22px; line-height:1.3; font-weight:700; color:#18181b;">${esc(heading)}</h1>
              <div style="font-family: Arial, Helvetica, sans-serif; font-size:15px; line-height:1.6; color:#3f3f46;">
                ${bodyHtml}
              </div>
              ${cta ? button(cta, accent) : ''}
            </td>
          </tr>
          <!-- footer -->
          <tr>
            <td style="padding: 20px 12px 8px; font-family: Arial, Helvetica, sans-serif; font-size:12px; line-height:1.6; color:#a1a1aa;">
              ${footerNote ? `<p style="margin:0 0 10px; color:#a1a1aa;">${footerNote}</p>` : ''}
              <p style="margin:0 0 4px; color:#a1a1aa;">${esc(brand.address || brandName)}</p>
              ${support ? `<p style="margin:0; color:#a1a1aa;">Вопросы: ${support}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
