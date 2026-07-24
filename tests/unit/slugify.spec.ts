import { describe, it, expect } from 'vitest'
import { slugify } from '@/lib/slugify'

/**
 * Юнит-тесты slugify (без БД): транслитерация кириллицы + нормализация.
 */
describe('slugify', () => {
  it('латиница и пробелы', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })
  it('транслитерация кириллицы', () => {
    expect(slugify('Привет Мир')).toBe('privet-mir')
    expect(slugify('Ёжик')).toBe('ezhik')
    expect(slugify('Щука')).toBe('schuka')
  })
  it('схлопывает и обрезает дефисы', () => {
    expect(slugify('a--b')).toBe('a-b')
    expect(slugify('-abc-')).toBe('abc')
    expect(slugify('  x  ')).toBe('x')
  })
  it('подчёркивание/точка → дефис, спецсимволы отбрасываются', () => {
    expect(slugify('test_123')).toBe('test-123')
    expect(slugify('a.b')).toBe('a-b')
    expect(slugify('Café!')).toBe('caf')
  })
  it('пустой ввод → пустая строка', () => {
    expect(slugify('')).toBe('')
  })
  it('ограничение длины 80 символов', () => {
    expect(slugify('a'.repeat(100))).toHaveLength(80)
  })
})
