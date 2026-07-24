import { describe, it, expect } from 'vitest'
import {
  isValidSubdomain,
  subdomainError,
  domainFromSubdomain,
  normalizeSubdomain,
  stripPort,
  subdomainFromHost,
  PLATFORM_ROOT,
} from '@/lib/subdomain'

/**
 * Юнит-тесты чистых функций поддомена/хоста (без БД).
 * Фиксируют поведение, консолидированное в Итерации 2 (parsing хоста в proxy.ts
 * и register-subscriber теперь берут stripPort/subdomainFromHost отсюда).
 */

describe('isValidSubdomain', () => {
  it('принимает корректные', () => {
    expect(isValidSubdomain('bts')).toBe(true)
    expect(isValidSubdomain('coco-jambo')).toBe(true)
    expect(isValidSubdomain('a1b2')).toBe(true)
  })
  it('отклоняет некорректные', () => {
    expect(isValidSubdomain('ab')).toBe(false) // короче 3
    expect(isValidSubdomain('a'.repeat(31))).toBe(false) // длиннее 30
    expect(isValidSubdomain('-abc')).toBe(false) // дефис в начале
    expect(isValidSubdomain('abc-')).toBe(false) // дефис в конце
    expect(isValidSubdomain('a--b')).toBe(false) // сдвоенный дефис
    expect(isValidSubdomain('ABC')).toBe(false) // заглавные
    expect(isValidSubdomain('a_b')).toBe(false) // подчёркивание
    expect(isValidSubdomain('прив')).toBe(false) // кириллица
  })
})

describe('subdomainError', () => {
  it('null для валидного незарезервированного', () => {
    expect(subdomainError('coco-jambo')).toBeNull()
    expect(subdomainError('bts')).toBeNull()
  })
  it('сообщение о формате для некорректного', () => {
    expect(subdomainError('ab')).toMatch(/3–30/)
  })
  it('сообщение о резерве для зарезервированного', () => {
    expect(subdomainError('admin')).toMatch(/зарезервирован/)
    expect(subdomainError('www')).toMatch(/зарезервирован/)
    expect(subdomainError('api')).toMatch(/зарезервирован/)
  })
})

describe('domainFromSubdomain', () => {
  it('строит полный домен тенанта', () => {
    expect(domainFromSubdomain('bts')).toBe('bts.contentbox.site')
    expect(domainFromSubdomain('bts')).toBe(`bts.${PLATFORM_ROOT}`)
  })
})

describe('normalizeSubdomain', () => {
  it('trim + lowercase', () => {
    expect(normalizeSubdomain('  BTS  ')).toBe('bts')
    expect(normalizeSubdomain('CoCo')).toBe('coco')
    expect(normalizeSubdomain('')).toBe('')
  })
})

describe('stripPort', () => {
  it('убирает порт и приводит к нижнему регистру', () => {
    expect(stripPort('bts.contentbox.site:3000')).toBe('bts.contentbox.site')
    expect(stripPort('Example.COM')).toBe('example.com')
    expect(stripPort('localhost:10000')).toBe('localhost')
  })
  it('null/пусто → пустая строка', () => {
    expect(stripPort(null)).toBe('')
    expect(stripPort('')).toBe('')
  })
})

describe('subdomainFromHost', () => {
  it('извлекает метку прямого поддомена', () => {
    expect(subdomainFromHost('bts.contentbox.site')).toBe('bts')
    expect(subdomainFromHost('coco-jambo.contentbox.site')).toBe('coco-jambo')
  })
  it('null для платформенных и чужих хостов', () => {
    expect(subdomainFromHost('contentbox.site')).toBeNull() // сам корень
    expect(subdomainFromHost('www.contentbox.site')).toBeNull() // www
    expect(subdomainFromHost('a.b.contentbox.site')).toBeNull() // многоуровневый
    expect(subdomainFromHost('example.com')).toBeNull() // чужой домен
    expect(subdomainFromHost('.contentbox.site')).toBeNull() // пустая метка
  })
})
