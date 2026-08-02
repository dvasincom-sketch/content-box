import geoip from 'fast-geoip'
import { clientIp } from './rateLimit'

/**
 * Гео посетителя по IP. Оффлайн-база в образе (fast-geoip: данные MaxMind
 * GeoLite2, читаются лениво с диска — почти без памяти, без API-ключа и без
 * сети в рантайме). Нужен только КОД СТРАНЫ, город не запрашиваем.
 *
 * ПОЛИТИКА — fail-open: если страну определить нельзя (нет заголовка, локальный
 * или приватный IP), возвращаем null и подсказку НЕ показываем. Ложный баннер
 * российскому посетителю хуже, чем его отсутствие у редкого «неопознанного».
 */

/** Приватные/зарезервированные диапазоны: за прокси сюда попадать не должны,
 *  но если попали (внутренний запрос, здоровье-чек, кривой x-forwarded-for) —
 *  fast-geoip вернёт мусорную страну (напр. 127.0.0.1 → JP), поэтому режем сами. */
function isPrivateOrReserved(ip: string): boolean {
  if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) return true
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (!m) return false
  const a = Number(m[1]), b = Number(m[2])
  if (a === 10 || a === 127) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 169 && b === 254) return true // link-local
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  return false
}

export async function viewerCountry(headers: { get(name: string): string | null }): Promise<string | null> {
  let ip = clientIp(headers)
  if (!ip || ip === 'unknown') return null
  // IPv4, завёрнутый в IPv6 (::ffff:1.2.3.4) — берём хвост.
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (mapped) ip = mapped[1]!
  if (isPrivateOrReserved(ip)) return null
  try {
    const geo = await geoip.lookup(ip)
    return geo?.country ? geo.country.toUpperCase() : null
  } catch {
    return null
  }
}

/** Посетитель уверенно вне РФ (заграница или VPN с зарубежным выходом). */
export async function isForeignViewer(headers: { get(name: string): string | null }): Promise<boolean> {
  const c = await viewerCountry(headers)
  return c != null && c !== 'RU'
}
