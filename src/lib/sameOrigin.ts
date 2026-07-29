/**
 * Same-origin проверка для мутирующих запросов — защита от CSRF.
 *
 * Почему не штатный `csrf` из payload.config: там задаётся СТАТИЧЕСКИЙ список
 * разрешённых origin'ов, а домены авторов динамические (`tenants.domain` +
 * любой `*.contentbox.site`). Перечислить их в конфиге невозможно, а неполный
 * список сломал бы логин на доменах, которых в нём нет. Поэтому сверяем Origin
 * с Host самого запроса — это работает для любого тенантного домена без списка.
 *
 * Что закрываем: роуты студии и кабинета — обычные Next-хендлеры, они читают
 * сессию через `payload.auth(headers)` и под CSRF-проверку Payload не попадают
 * вовсе. JSON-роуты частично прикрыты preflight'ом (кросс-доменная форма не
 * выставит `Content-Type: application/json`), но multipart-роуты — загрузка
 * обложек, логотипа, картинок галереи, аватара — уязвимы обычной формой с
 * `enctype=multipart/form-data`, которая отправляется без preflight.
 *
 * Порядок проверок:
 *  1. `Sec-Fetch-Site` — если браузер прислал `cross-site`, отказ сразу.
 *     Этот заголовок нельзя подделать из JS, и он есть во всех современных
 *     браузерах.
 *  2. `Origin` против Host запроса.
 *  3. Ни того, ни другого нет — пропускаем: так ведут себя не-браузерные
 *     клиенты (curl, серверные вызовы), а для них CSRF не имеет смысла.
 *     Ужесточать до «нет Origin → отказ» нельзя, это ломает server actions
 *     и вызовы из тестов.
 */
export function isSameOrigin(req: {
  headers: { get(name: string): string | null }
}): boolean {
  const fetchSite = req.headers.get('sec-fetch-site')
  if (fetchSite) {
    // same-origin | same-site | none (прямой переход/закладка) — свои.
    return fetchSite !== 'cross-site'
  }

  const origin = req.headers.get('origin')
  if (!origin) return true

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (!host) return false

  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/** Методы, которые меняют состояние и потому требуют проверки. */
export function isMutating(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
}
