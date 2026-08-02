import geoip from 'fast-geoip'

/**
 * Гео посетителя по IP. Оффлайн-база в образе (fast-geoip: данные MaxMind
 * GeoLite2, читаются лениво с диска — почти без памяти, без API-ключа и без
 * сети в рантайме). Нужен только КОД СТРАНЫ.
 *
 * ПОЛИТИКА — fail-open: если страну определить нельзя (нет заголовка, локальный
 * или приватный IP), возвращаем null и подсказку НЕ показываем. Ложный баннер
 * российскому посетителю хуже, чем его отсутствие у редкого «неопознанного».
 *
 * IP КЛИЕНТА ЗА ПРОКСИ. За фронт-прокси (Timeweb/Caddy, иногда CDN) реальный IP
 * приезжает в одном из заголовков. Берём первый ПУБЛИЧНЫЙ адрес из списка
 * кандидатов по убыванию доверия — так определение переживает разные схемы
 * проксирования, а не завязано на один заголовок.
 */

/** Нормализуем адрес: снимаем ::ffff: обёртку и порт. */
function normalizeIp(raw: string): string | null {
  let ip = raw.trim()
  if (!ip) return null
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (mapped) ip = mapped[1]!
  const withPort = ip.match(/^(\d+\.\d+\.\d+\.\d+):\d+$/)
  if (withPort) ip = withPort[1]!
  return ip || null
}

/** Приватные/зарезервированные диапазоны — их геолокация бессмысленна
 *  (fast-geoip вернёт мусор, напр. 127.0.0.1 → JP), поэтому пропускаем. */
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

type Hdr = { get(name: string): string | null }

/** Кандидаты IP клиента по убыванию доверия. Каждый заголовок может содержать
 *  цепочку — разворачиваем в отдельные адреса. */
export function ipCandidates(headers: Hdr): string[] {
  const out: string[] = []
  const add = (value: string | null) => {
    if (!value) return
    for (const part of value.split(',')) {
      const ip = normalizeIp(part)
      if (ip) out.push(ip)
    }
  }
  add(headers.get('cf-connecting-ip'))
  add(headers.get('true-client-ip'))
  add(headers.get('x-real-ip'))
  add(headers.get('x-forwarded-for'))
  return out
}

/** Страна первого ПУБЛИЧНОГО кандидата, что резолвится (ISO, верхний регистр). */
export async function viewerCountry(headers: Hdr): Promise<string | null> {
  for (const ip of ipCandidates(headers)) {
    if (isPrivateOrReserved(ip)) continue
    try {
      const geo = await geoip.lookup(ip)
      if (geo?.country) return geo.country.toUpperCase()
    } catch {
      /* база недоступна для этого адреса — пробуем следующий */
    }
  }
  return null
}

/** Посетитель уверенно вне РФ (заграница или VPN с зарубежным выходом). */
export async function isForeignViewer(headers: Hdr): Promise<boolean> {
  const c = await viewerCountry(headers)
  return c != null && c !== 'RU'
}

/**
 * Диагностика определения гео (для /api/geo-debug). Показывает, какие заголовки
 * реально приходят за прокси, какой IP/страну из них извлекаем, и self-test —
 * работает ли база в проде на заведомо известных адресах. Отдаёт только данные
 * самогó вызывающего, ничего лишнего.
 */
export async function geoDebug(headers: Hdr) {
  const candidates = []
  for (const ip of ipCandidates(headers)) {
    const priv = isPrivateOrReserved(ip)
    let country: string | null = null
    if (!priv) {
      try {
        country = (await geoip.lookup(ip))?.country?.toUpperCase() ?? null
      } catch {
        country = null
      }
    }
    candidates.push({ ip, private: priv, country })
  }

  const selftest: Record<string, string | null> = {}
  for (const [k, ip] of Object.entries({ 'US(8.8.8.8)': '8.8.8.8', 'RU(77.88.55.60)': '77.88.55.60' })) {
    try {
      selftest[k] = (await geoip.lookup(ip))?.country?.toUpperCase() ?? null
    } catch (e) {
      selftest[k] = 'ERR:' + String(e)
    }
  }

  return {
    headersSeen: {
      'cf-connecting-ip': headers.get('cf-connecting-ip'),
      'true-client-ip': headers.get('true-client-ip'),
      'x-real-ip': headers.get('x-real-ip'),
      'x-forwarded-for': headers.get('x-forwarded-for'),
      'x-forwarded-host': headers.get('x-forwarded-host'),
      forwarded: headers.get('forwarded'),
    },
    candidates,
    resolvedCountry: await viewerCountry(headers),
    foreign: await isForeignViewer(headers),
    // Если selftest вернул null/ERR — база в проде не читается (это и есть баг).
    selftest,
  }
}
