import { renderLayout, esc, PLATFORM_BRAND, type EmailBrand } from './layout'

/**
 * Шаблоны транзакционных писем (фаза 1).
 *
 * Каждая функция возвращает { subject, html } — готово для отправки через
 * почтовый адаптер Payload (RuSender по SMTP). Тело собирается из
 * экранированных значений; бренд задаётся параметром (по умолчанию — платформа).
 */

export type RenderedEmail = { subject: string; html: string }

const p = (html: string) => `<p style="margin:0 0 14px;">${html}</p>`

/**
 * Приветствие ПОДПИСЧИКУ после регистрации на сайте автора.
 * brand — бренд автора/тенанта (имя/цвет/лого); дефолт — платформа.
 */
export function subscriberWelcomeEmail(params: {
  brand: EmailBrand
  displayName?: string | null
  siteUrl: string
}): RenderedEmail {
  const { brand, displayName, siteUrl } = params
  const name = displayName?.trim()
  const hello = name ? `Здравствуйте, ${esc(name)}!` : 'Здравствуйте!'
  const bodyHtml =
    p(hello) +
    p(`Вы зарегистрировались на <b>${esc(brand.name)}</b>. Теперь вам доступны публикации, видео и подписки автора.`) +
    p('Нажмите кнопку ниже, чтобы вернуться на сайт и продолжить.')

  return {
    subject: `Добро пожаловать на ${brand.name}`,
    html: renderLayout({
      brand,
      preheader: `Ваш аккаунт на ${brand.name} создан`,
      heading: 'Добро пожаловать!',
      bodyHtml,
      cta: { label: 'Перейти на сайт', url: siteUrl },
    }),
  }
}

/**
 * Приветствие АВТОРУ после регистрации на платформе.
 * Всегда от бренда платформы. siteUrl — публичный адрес автора (поддомен),
 * studioUrl — вход в студию.
 */
export function authorWelcomeEmail(params: {
  name?: string | null
  siteUrl: string
  studioUrl: string
}): RenderedEmail {
  const { name, siteUrl, studioUrl } = params
  const brand = PLATFORM_BRAND
  const hello = name?.trim() ? `Здравствуйте, ${esc(name)}!` : 'Здравствуйте!'
  const bodyHtml =
    p(hello) +
    p('Ваш проект на <b>Content Box</b> создан и уже доступен по адресу:') +
    p(`<a href="${esc(siteUrl)}" target="_blank" style="color:${brand.color}; text-decoration:underline;">${esc(siteUrl)}</a>`) +
    p('В студии можно настроить бренд, добавить категории, публикации и видео, подключить подписки. Начните с кнопки ниже.') +
    p('<span style="color:#71717a; font-size:13px;">Если вы не создавали проект — просто проигнорируйте это письмо.</span>')

  return {
    subject: 'Ваш проект на Content Box создан',
    html: renderLayout({
      brand,
      preheader: 'Проект создан — можно приступать к настройке студии',
      heading: 'Проект создан 🎉',
      bodyHtml,
      cta: { label: 'Открыть студию', url: studioUrl },
    }),
  }
}

/**
 * Сброс пароля. Работает и для авторов, и для подписчиков — бренд и ссылка
 * передаются параметром. resetUrl — одноразовая ссылка сброса.
 */
export function passwordResetEmail(params: {
  brand: EmailBrand
  resetUrl: string
  name?: string | null
  expiresHint?: string
}): RenderedEmail {
  const { brand, resetUrl, name } = params
  const expiresHint = params.expiresHint || 'Ссылка действует ограниченное время.'
  const hello = name?.trim() ? `Здравствуйте, ${esc(name)}!` : 'Здравствуйте!'
  const bodyHtml =
    p(hello) +
    p(`Вы запросили сброс пароля на <b>${esc(brand.name)}</b>. Нажмите кнопку, чтобы задать новый пароль.`) +
    p(`<span style="color:#71717a; font-size:13px;">${esc(expiresHint)} Если вы не запрашивали сброс — просто проигнорируйте это письмо, пароль останется прежним.</span>`)

  return {
    subject: `Сброс пароля · ${brand.name}`,
    html: renderLayout({
      brand,
      preheader: 'Ссылка для сброса пароля',
      heading: 'Сброс пароля',
      bodyHtml,
      cta: { label: 'Задать новый пароль', url: resetUrl },
    }),
  }
}

/**
 * Подтверждение email при регистрации (verify). verifyUrl — ссылка подтверждения.
 */
export function verifyEmail(params: {
  brand: EmailBrand
  verifyUrl: string
  name?: string | null
}): RenderedEmail {
  const { brand, verifyUrl, name } = params
  const hello = name?.trim() ? `Здравствуйте, ${esc(name)}!` : 'Здравствуйте!'
  const bodyHtml =
    p(hello) +
    p(`Подтвердите свой email, чтобы завершить регистрацию на <b>${esc(brand.name)}</b>.`) +
    p('<span style="color:#71717a; font-size:13px;">Если вы не регистрировались — просто проигнорируйте это письмо.</span>')

  return {
    subject: `Подтвердите email · ${brand.name}`,
    html: renderLayout({
      brand,
      preheader: 'Подтверждение адреса электронной почты',
      heading: 'Подтвердите email',
      bodyHtml,
      cta: { label: 'Подтвердить email', url: verifyUrl },
    }),
  }
}
