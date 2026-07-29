/**
 * Простой ограничитель частоты запросов для публичных POST-роутов.
 *
 * До этого во всём проекте не было ни одного лимита. Практические последствия:
 *  - `/api/register-author` позволял анонимно создавать неограниченное число
 *    тенантов, каждый сразу `active` + `domainVerified`, то есть немедленно
 *    обслуживаемый на поддомене и попадающий в обход дайджеста;
 *  - `/api/register-subscriber` давал перечисление адресов (409 против 200)
 *    и рассылку писем на чужие ящики;
 *  - `/api/verify-email` и `/api/notifications/unsubscribe` — перебор токенов
 *    (смягчён 256-битной энтропией, но лимит всё равно нужен);
 *  - `/api/search` — неограниченная нагрузка на Meilisearch.
 *
 * ХРАНИЛИЩЕ — ПАМЯТЬ ПРОЦЕССА. Это осознанный компромисс: лимит на уровне БД
 * потребовал бы новой таблицы и миграции, а Redis — ещё одного сервиса. Отсюда
 * два ограничения, о которых нужно помнить:
 *   1) счётчики обнуляются при рестарте контейнера;
 *   2) при нескольких репликах каждая считает свои — фактический лимит
 *      умножается на число реплик.
 * Для защиты от скриптового абьюза этого достаточно; когда появится вторая
 * реплика, здесь нужно будет заменить Map на общее хранилище — интерфейс
 * менять не придётся.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/** Чтобы Map не рос бесконечно: подчищаем протухшие записи при обращении. */
let lastSweep = 0
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key)
  }
}

/** Предупреждение в лог один раз за жизнь процесса, чтобы не засорять его. */
const warned = new Set<string>()
function warnOnce(message: string): void {
  if (warned.has(message)) return
  warned.add(message)
  console.warn(message)
}

export type RateLimitResult = {
  ok: boolean
  /** Сколько секунд ждать до следующей попытки (для Retry-After). */
  retryAfter: number
}

/**
 * Израсходовать одну попытку в окне.
 *
 * @param key   что именно ограничиваем — включайте имя роута, иначе разные
 *              роуты будут делить один счётчик (например `register-author:1.2.3.4`).
 * @param limit сколько попыток разрешено в окне.
 * @param windowMs длина окна в миллисекундах.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  // IP определить не удалось (прокси не прислал заголовков) — НЕ ограничиваем.
  // Иначе все запросы платформы попали бы в один бакет `unknown`, и лимит
  // «3 регистрации в час» стал бы общим на весь сервис: регистрация встала бы
  // целиком, а внешне это выглядело бы как штатная защита от абьюза.
  if (key.endsWith(':unknown')) {
    warnOnce(
      '[rateLimit] не удалось определить IP клиента (нет x-forwarded-for / x-real-ip) — ограничение отключено',
    )
    return { ok: true, retryAfter: 0 }
  }

  const now = Date.now()
  sweep(now)

  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  b.count += 1
  if (b.count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) }
  }
  return { ok: true, retryAfter: 0 }
}

/**
 * IP клиента за прокси Timeweb. `x-forwarded-for` может содержать цепочку —
 * берём первый адрес (его подставляет ближайший к клиенту прокси).
 *
 * Заголовок подделывается, поэтому это лимит «на добросовестного клиента и
 * простой скрипт», а не защита от распределённой атаки. При отсутствии
 * заголовков все запросы попадают в один бакет `unknown` — это осознанно:
 * лучше общий лимит, чем никакого.
 */
export function clientIp(headers: { get(name: string): string | null }): string {
  const fwd = headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip') || 'unknown'
}

/** Готовый 429 с Retry-After. */
export function tooManyRequests(retryAfter: number, message?: string): Response {
  return new Response(
    JSON.stringify({ error: message ?? 'Слишком много запросов. Попробуйте позже.' }),
    {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': String(retryAfter),
      },
    },
  )
}
