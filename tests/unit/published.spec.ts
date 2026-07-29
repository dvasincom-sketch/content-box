import { describe, it, expect } from 'vitest'
import { publishedWhere, isPublished } from '@/lib/published'

/**
 * Черновик у публикаций — это `publishedAt = null` (отдельного _status нет).
 * Фильтр забыли сразу в трёх ключевых выборках, и из-за NULLS FIRST при
 * `sort: '-publishedAt'` черновики встали бы В НАЧАЛО ленты. Проверяем условие
 * и его точечный аналог для одного документа.
 */
describe('publishedWhere', () => {
  it('условие — верхняя граница по дате, а не проверка на существование', () => {
    // `exists: true` пропустил бы отложенную публикацию с датой в будущем.
    expect(publishedWhere('2026-07-29T00:00:00.000Z')).toEqual({
      publishedAt: { less_than_equal: '2026-07-29T00:00:00.000Z' },
    })
  })

  it('без аргумента подставляет текущий момент', () => {
    const w = publishedWhere() as { publishedAt: { less_than_equal: string } }
    const ts = new Date(w.publishedAt.less_than_equal).getTime()
    expect(Number.isFinite(ts)).toBe(true)
    expect(Math.abs(Date.now() - ts)).toBeLessThan(5000)
  })
})

describe('isPublished', () => {
  it('черновик без даты — не опубликован', () => {
    expect(isPublished({ publishedAt: null })).toBe(false)
    expect(isPublished({})).toBe(false)
    expect(isPublished(null)).toBe(false)
    expect(isPublished(undefined)).toBe(false)
  })

  it('дата в прошлом — опубликован', () => {
    expect(isPublished({ publishedAt: '2020-01-01T00:00:00.000Z' })).toBe(true)
  })

  it('дата в будущем (отложенная публикация) — ещё не опубликован', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    expect(isPublished({ publishedAt: future })).toBe(false)
  })
})
