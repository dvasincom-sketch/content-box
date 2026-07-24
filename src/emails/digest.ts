import { renderLayout, esc, type EmailBrand } from './layout'
import type { RenderedEmail } from './templates'

/**
 * Дайджест новых материалов подписчику (пачкой, а не по одному событию).
 *
 * Бренд — тенанта (имя/цвет/лого). Список материалов со ссылками на сайт
 * автора + обязательная ссылка «отписаться» в футере.
 */

export type DigestItem = {
  title: string
  url: string
  category?: string | null
}

export function digestEmail(params: {
  brand: EmailBrand
  siteUrl: string
  items: DigestItem[]
  unsubscribeUrl: string
}): RenderedEmail {
  const { brand, siteUrl, items, unsubscribeUrl } = params
  const accent = brand.color || '#7C3AED'
  const count = items.length
  const heading = count === 1 ? 'Новый материал' : `Новые материалы: ${count}`

  const list = items
    .map(
      (it) => `
      <p style="margin:0 0 16px;">
        <a href="${esc(it.url)}" target="_blank" style="color:${esc(accent)}; text-decoration:none; font-weight:600; font-size:16px;">${esc(it.title)}</a>${
          it.category
            ? `<br><span style="color:#71717a; font-size:13px;">${esc(it.category)}</span>`
            : ''
        }
      </p>`,
    )
    .join('')

  const bodyHtml = `<p style="margin:0 0 18px;">Что нового на <b>${esc(brand.name)}</b> с прошлого дайджеста:</p>${list}`

  const footerNote = `Вы получаете это письмо как подписчик <b>${esc(brand.name)}</b>. <a href="${esc(unsubscribeUrl)}" target="_blank" style="color:#a1a1aa; text-decoration:underline;">Отписаться от дайджеста</a>.`

  return {
    subject: `${heading} · ${brand.name}`,
    html: renderLayout({
      brand,
      preheader: `${heading} на ${brand.name}`,
      heading,
      bodyHtml,
      cta: { label: 'Открыть сайт', url: siteUrl },
      footerNote,
    }),
  }
}
