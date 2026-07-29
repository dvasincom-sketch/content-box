import { describe, it, expect, vi, afterEach } from 'vitest'
import { rateLimit, clientIp } from '@/lib/rateLimit'

const hdrs = (map: Record<string, string>) => ({
  get: (name: string) => map[name.toLowerCase()] ?? null,
})

afterEach(() => {
  vi.useRealTimers()
})

describe('rateLimit', () => {
  it('пропускает до лимита и отказывает после', () => {
    const key = `t1:${Math.random()}`
    expect(rateLimit(key, 3, 60_000).ok).toBe(true)
    expect(rateLimit(key, 3, 60_000).ok).toBe(true)
    expect(rateLimit(key, 3, 60_000).ok).toBe(true)

    const denied = rateLimit(key, 3, 60_000)
    expect(denied.ok).toBe(false)
    expect(denied.retryAfter).toBeGreaterThan(0)
  })

  it('ключи независимы — разные роуты и IP не делят счётчик', () => {
    const a = `t2a:${Math.random()}`
    const b = `t2b:${Math.random()}`
    expect(rateLimit(a, 1, 60_000).ok).toBe(true)
    expect(rateLimit(a, 1, 60_000).ok).toBe(false)
    // Другой ключ не затронут.
    expect(rateLimit(b, 1, 60_000).ok).toBe(true)
  })

  it('после окна счётчик обнуляется', () => {
    vi.useFakeTimers()
    const key = `t3:${Math.random()}`
    expect(rateLimit(key, 1, 1_000).ok).toBe(true)
    expect(rateLimit(key, 1, 1_000).ok).toBe(false)

    vi.advanceTimersByTime(1_500)
    expect(rateLimit(key, 1, 1_000).ok).toBe(true)
  })
})

describe('clientIp', () => {
  it('берёт первый адрес из цепочки x-forwarded-for', () => {
    expect(clientIp(hdrs({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1, 10.0.0.2' }))).toBe('203.0.113.9')
  })

  it('фолбэк на x-real-ip', () => {
    expect(clientIp(hdrs({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7')
  })

  it('без заголовков — маркер unknown (по нему лимит отключается)', () => {
    expect(clientIp(hdrs({}))).toBe('unknown')
  })
})

describe('rateLimit: неизвестный IP', () => {
  it('не ограничивает, когда IP определить не удалось', () => {
    // Иначе все запросы платформы попали бы в один бакет и лимит стал бы
    // общим на весь сервис — регистрация встала бы целиком.
    const key = 'register-author:unknown'
    for (let i = 0; i < 50; i++) {
      expect(rateLimit(key, 1, 60_000).ok).toBe(true)
    }
  })
})
