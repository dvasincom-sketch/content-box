import { describe, it, expect } from 'vitest'
import { filterLiteral } from '@/search/query'

/**
 * Фильтр Meilisearch — единственное, что изолирует тенантов в общем индексе
 * `content`. Раньше значения подставлялись в строку как есть, а `type` и
 * `category` приходили сырыми из query-строки, поэтому значение с кавычкой
 * разрывало выражение и снимало условие по тенанту (AND связывает сильнее OR).
 */
describe('filterLiteral', () => {
  it('оборачивает обычное значение в кавычки', () => {
    expect(filterLiteral('publication')).toBe('"publication"')
    expect(filterLiteral(42)).toBe('"42"')
  })

  it('экранирует кавычку — попытка инъекции остаётся одним литералом', () => {
    const injected = 'x" OR tenant = "7'
    const out = filterLiteral(injected)

    expect(out).toBe('"x\\" OR tenant = \\"7"')
    // Ключевое свойство: неэкранированных кавычек внутри литерала нет,
    // значит выражение `type = <literal>` невозможно закрыть раньше времени.
    expect(out.slice(1, -1)).not.toMatch(/(^|[^\\])"/)
  })

  it('экранирует обратный слэш (иначе им же можно снять экранирование кавычки)', () => {
    expect(filterLiteral('a\\b')).toBe('"a\\\\b"')
    expect(filterLiteral('a\\" OR x = "1')).toBe('"a\\\\\\" OR x = \\"1"')
  })

  it('собранное выражение остаётся двумя условиями, а не тремя', () => {
    const expr = [
      `tenant = ${filterLiteral('1')}`,
      `type = ${filterLiteral('x" OR tenant = "7')}`,
    ].join(' AND ')

    expect(expr.split(' AND ')).toHaveLength(2)
    expect(expr).not.toContain('OR tenant = "7"')
  })
})
