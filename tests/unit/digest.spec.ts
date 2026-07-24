import { describe, it, expect } from 'vitest'
import { digestEmail } from '@/emails/digest'
import type { EmailBrand } from '@/emails/layout'

/**
 * Юнит-тесты сборки письма-дайджеста (без сети). Проверяем счётчик в теме,
 * ссылки на материалы, ссылку отписки и экранирование.
 */

const brand: EmailBrand = { name: 'Студия Кита', color: '#0EA5E9', siteUrl: 'https://kit.example' }

describe('digestEmail', () => {
  it('несколько материалов: счётчик в теме, все ссылки в теле', () => {
    const mail = digestEmail({
      brand,
      siteUrl: 'https://kit.example',
      items: [
        { title: 'Первый пост', url: 'https://kit.example/publication/first', category: 'Новости' },
        { title: 'Второй пост', url: 'https://kit.example/publication/second' },
      ],
      unsubscribeUrl: 'https://kit.example/unsubscribe?token=abc',
    })
    expect(mail.subject).toContain('2')
    expect(mail.subject).toContain('Студия Кита')
    expect(mail.html).toContain('https://kit.example/publication/first')
    expect(mail.html).toContain('https://kit.example/publication/second')
    expect(mail.html).toContain('Новости')
  })

  it('один материал: тема в единственном числе', () => {
    const mail = digestEmail({
      brand,
      siteUrl: 'https://kit.example',
      items: [{ title: 'Единственный', url: 'https://kit.example/publication/one' }],
      unsubscribeUrl: 'https://kit.example/unsubscribe?token=abc',
    })
    expect(mail.subject).toContain('Новый материал')
  })

  it('ссылка отписки присутствует в футере', () => {
    const mail = digestEmail({
      brand,
      siteUrl: 'https://kit.example',
      items: [{ title: 'X', url: 'https://kit.example/publication/x' }],
      unsubscribeUrl: 'https://kit.example/unsubscribe?token=tok123',
    })
    expect(mail.html).toContain('https://kit.example/unsubscribe?token=tok123')
    expect(mail.html).toContain('Отписаться')
  })

  it('экранирует HTML в заголовке материала', () => {
    const mail = digestEmail({
      brand,
      siteUrl: 'https://kit.example',
      items: [{ title: '<script>alert(1)</script>', url: 'https://kit.example/publication/x' }],
      unsubscribeUrl: 'https://kit.example/unsubscribe?token=abc',
    })
    expect(mail.html).not.toContain('<script>alert(1)</script>')
    expect(mail.html).toContain('&lt;script&gt;')
  })
})
