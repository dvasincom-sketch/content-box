import { describe, it, expect, vi } from 'vitest'
import { sqlRows, toIntArray } from '@/lib/sql'

/**
 * Прямой SQL появился ради агрегатов, которых нет в Local API. Проверяем две
 * вещи, где ошибка была бы тихой: что параметры уходят отдельно от текста
 * запроса (а не склеиваются в строку), и что мусор в списке id не превращается
 * в `NaN` внутри `= ANY($n::int[])`.
 */

const fakePayload = (rows: unknown[], spy?: (t: string, p?: unknown[]) => void) =>
  ({
    db: {
      pool: {
        query: async (text: string, params?: unknown[]) => {
          spy?.(text, params)
          return { rows }
        },
      },
    },
  }) as any

describe('sqlRows', () => {
  it('передаёт параметры отдельным аргументом, не подставляя их в текст', async () => {
    const spy = vi.fn()
    await sqlRows(fakePayload([], spy), 'SELECT $1::int AS x', [42])

    const [text, params] = spy.mock.calls[0]
    expect(text).toBe('SELECT $1::int AS x')
    expect(params).toEqual([42])
    // Значение не должно оказаться в самом SQL — иначе это инъекция.
    expect(text).not.toContain('42')
  })

  it('возвращает rows', async () => {
    const rows = await sqlRows<{ id: number }>(fakePayload([{ id: 1 }, { id: 2 }]), 'SELECT 1')
    expect(rows).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('падает понятно, если адаптер БД не отдаёт pool', async () => {
    await expect(sqlRows({ db: {} } as any, 'SELECT 1')).rejects.toThrow(/pool/)
  })
})

describe('toIntArray', () => {
  it('приводит строковые id к числам', () => {
    expect(toIntArray(['1', 2, '3'])).toEqual([1, 2, 3])
  })

  it('отбрасывает всё, что не целое — иначе в запрос уедет NaN', () => {
    expect(toIntArray(['abc', '', '1.5', NaN as unknown as number, 7])).toEqual([7])
  })

  it('пустой вход — пустой выход', () => {
    expect(toIntArray([])).toEqual([])
  })
})
