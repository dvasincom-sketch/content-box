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
  /** Логин (email) для блока «данные для входа». */
  loginEmail?: string | null
  /** Пароль показывается один раз — если передан, добавляем блок с реквизитами. */
  password?: string | null
}): RenderedEmail {
  const { name, siteUrl, studioUrl, loginEmail, password } = params
  const brand = PLATFORM_BRAND
  const hello = name?.trim() ? `Здравствуйте, ${esc(name)}!` : 'Здравствуйте!'
  const creds = password
    ? p('<b>Данные для входа</b> — сохраните, пароль показывается один раз:') +
      `<div style="font-family: monospace; font-size:14px; color:#18181b; background:#f4f4f5; border:1px solid #e4e4e7; border-radius:10px; padding:12px 14px; margin:0 0 14px; line-height:1.7; word-break:break-all;">Email: ${esc(loginEmail)}<br>Пароль: ${esc(password)}</div>` +
      p('<span style="color:#71717a; font-size:13px;">Пароль можно сменить в студии в разделе «Профиль».</span>')
    : ''
  const bodyHtml =
    p(hello) +
    p('Ваш проект на <b>Content Box</b> создан и уже доступен по адресу:') +
    p(`<a href="${esc(siteUrl)}" target="_blank" style="color:${brand.color}; text-decoration:underline;">${esc(siteUrl)}</a>`) +
    creds +
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

/**
 * Код подтверждения передачи прав владельца проекта (на email текущего
 * владельца). Показываем крупный код; действует 5 минут.
 */
export function ownerTransferCodeEmail(params: { brand?: EmailBrand; code: string; projectName: string; targetName: string }): RenderedEmail {
  const brand = params.brand || PLATFORM_BRAND
  const bodyHtml =
    p(`Вы запросили передачу прав владельца проекта <b>${esc(params.projectName)}</b> участнику <b>${esc(params.targetName)}</b>.`) +
    p('Введите код подтверждения в студии:') +
    `<p style="margin:6px 0 16px; text-align:center;"><span style="display:inline-block; font-size:30px; font-weight:800; letter-spacing:6px; padding:12px 22px; border-radius:12px; background:#f4f4f5; color:#18181b; font-family:monospace;">${esc(params.code)}</span></p>` +
    p('<span style="color:#71717a; font-size:13px;">Код действует 5 минут. После подтверждения вы станете администратором, а владельцем — выбранный участник. Если вы НЕ запрашивали передачу — не вводите код и смените пароль.</span>')
  return {
    subject: `Код передачи прав · ${params.projectName}`,
    html: renderLayout({ brand, preheader: 'Код подтверждения передачи прав владельца', heading: 'Передача прав владельца', bodyHtml }),
  }
}

/** Уведомление НОВОМУ владельцу, что права переданы ему. */
export function ownerTransferDoneEmail(params: { brand?: EmailBrand; projectName: string; studioUrl: string }): RenderedEmail {
  const brand = params.brand || PLATFORM_BRAND
  const bodyHtml =
    p(`Вам передали права владельца проекта <b>${esc(params.projectName)}</b>.`) +
    p('Теперь вы управляете настройками, командой, подпиской и всем контентом проекта.')
  return {
    subject: `Вы — владелец проекта · ${params.projectName}`,
    html: renderLayout({ brand, preheader: 'Вам переданы права владельца', heading: 'Вы теперь владелец', bodyHtml, cta: { label: 'Открыть студию', url: params.studioUrl } }),
  }
}
