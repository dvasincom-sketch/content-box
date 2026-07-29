import { describe, it, expect } from 'vitest'
import { isSameOrigin, isMutating } from '@/lib/sameOrigin'

const req = (map: Record<string, string>) => ({
  headers: { get: (name: string) => map[name.toLowerCase()] ?? null },
})

/**
 * CSRF-защита мутирующих роутов. Штатный `csrf` из payload.config здесь не
 * годится — он статический список origin'ов, а домены авторов динамические.
 * Поэтому сверяем Origin с Host самого запроса.
 */
describe('isSameOrigin', () => {
  it('Sec-Fetch-Site: cross-site — отказ (заголовок нельзя подделать из JS)', () => {
    expect(isSameOrigin(req({ 'sec-fetch-site': 'cross-site' }))).toBe(false)
  })

  it('same-origin / same-site / none — свои', () => {
    expect(isSameOrigin(req({ 'sec-fetch-site': 'same-origin' }))).toBe(true)
    expect(isSameOrigin(req({ 'sec-fetch-site': 'same-site' }))).toBe(true)
    // `none` — прямой переход или закладка, не кросс-сайтовый запрос.
    expect(isSameOrigin(req({ 'sec-fetch-site': 'none' }))).toBe(true)
  })

  it('Origin сверяется с Host запроса, а не со списком доменов', () => {
    // Собственный домен автора проходит без всякого конфига — в этом весь смысл.
    expect(
      isSameOrigin(req({ origin: 'https://bts.example.com', host: 'bts.example.com' })),
    ).toBe(true)
    expect(
      isSameOrigin(req({ origin: 'https://evil.example', host: 'bts.example.com' })),
    ).toBe(false)
  })

  it('за прокси сверяется с x-forwarded-host', () => {
    expect(
      isSameOrigin(
        req({
          origin: 'https://author.contentbox.site',
          host: 'internal-container:3000',
          'x-forwarded-host': 'author.contentbox.site',
        }),
      ),
    ).toBe(true)
  })

  it('битый Origin — отказ', () => {
    expect(isSameOrigin(req({ origin: 'not-a-url', host: 'a.example' }))).toBe(false)
  })

  it('ни Sec-Fetch-Site, ни Origin — пропускаем (не браузер, CSRF неприменим)', () => {
    // Ужесточение здесь сломало бы server actions и вызовы из тестов.
    expect(isSameOrigin(req({}))).toBe(true)
  })
})

describe('isMutating', () => {
  it('проверяются только методы, меняющие состояние', () => {
    expect(isMutating('POST')).toBe(true)
    expect(isMutating('PATCH')).toBe(true)
    expect(isMutating('DELETE')).toBe(true)
    expect(isMutating('GET')).toBe(false)
    expect(isMutating('HEAD')).toBe(false)
    expect(isMutating('OPTIONS')).toBe(false)
  })
})
