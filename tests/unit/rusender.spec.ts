import { describe, it, expect } from 'vitest'
import { parseAddress, toRecipients } from '@/emails/rusenderAdapter'

/**
 * Юнит-тесты разбора адресов почтового адаптера RuSender (без сети).
 */

describe('parseAddress', () => {
  it('простой email', () => {
    expect(parseAddress('user@example.com')).toEqual({ email: 'user@example.com' })
  })
  it('«Имя <email>»', () => {
    expect(parseAddress('Content Box <noreply@contentbox.site>')).toEqual({
      email: 'noreply@contentbox.site',
      name: 'Content Box',
    })
  })
  it('объект nodemailer { name, address }', () => {
    expect(parseAddress({ name: 'Алексей', address: 'a@b.ru' })).toEqual({
      email: 'a@b.ru',
      name: 'Алексей',
    })
  })
  it('пусто/мусор → null', () => {
    expect(parseAddress('')).toBeNull()
    expect(parseAddress(null)).toBeNull()
    expect(parseAddress('нет-адреса')).toBeNull()
  })
})

describe('toRecipients', () => {
  it('одна строка', () => {
    expect(toRecipients('a@b.ru')).toEqual([{ email: 'a@b.ru' }])
  })
  it('строка через запятую', () => {
    expect(toRecipients('a@b.ru, Имя <c@d.ru>')).toEqual([
      { email: 'a@b.ru' },
      { email: 'c@d.ru', name: 'Имя' },
    ])
  })
  it('массив строк и объектов', () => {
    expect(toRecipients(['a@b.ru', { name: 'X', address: 'x@y.ru' }])).toEqual([
      { email: 'a@b.ru' },
      { email: 'x@y.ru', name: 'X' },
    ])
  })
  it('пустой ввод → []', () => {
    expect(toRecipients(undefined)).toEqual([])
  })
})
