/**
 * Разбор внешних видео-ссылок во встраиваемый src.
 *
 * ЗАЧЕМ ИМЕННО ТАК. Автор вставляет что угодно — ссылку на видео или готовый
 * код `<iframe …>` с площадки. Мы НЕ храним и НЕ выводим этот HTML: сырая
 * разметка от автора в странице — это XSS, а регистрация авторов у нас
 * открытая, так что «автор» и «доверенный» не синонимы. Вместо этого мы
 * достаём из ввода адрес, сверяем ХОСТ с точным белым списком и дальше сами
 * собираем iframe с нужными нам `allow`, `referrerpolicy` и пропорциями.
 *
 * Белый список — это и есть точка контроля. Всё, чего в нём нет, отвергается,
 * включая `javascript:` и `data:`.
 *
 * ПРО ФОРМАТЫ. Для VK формат встраивания известен и стабилен
 * (`video_ext.php?oid=…&id=…&hash=…`), поэтому ссылку вида `vk.com/video-1_2`
 * мы умеем превращать в embed сами. Для Дзена официально опубликованного
 * шаблона нет — справка описывает только «Поделиться → Встроить». Поэтому
 * основной путь для него (и запасной для всех): взять `src` из вставленного
 * кода как есть, проверив хост. Так парсер не сломается, если площадка сменит
 * вид ссылки, и нам не нужно угадывать её формат.
 *
 * ВАЖНОЕ ОГРАНИЧЕНИЕ, не техническое: внешний embed НЕЛЬЗЯ закрыть подпиской.
 * Браузер обязан загрузить iframe с чужого домена, значит адрес виден и в
 * исходнике страницы, и в сетевых запросах. Параметр `hash` у VK — это ключ
 * доступа к приватному видео, и после вставки на страницу он публичный.
 * Гейтинг по minTier для таких видео работает как мягкий барьер, не более.
 */

export type EmbedProvider = 'vk' | 'vk-clip' | 'dzen'
export type EmbedAspect = '16:9' | '9:16'

export type ParsedEmbed = {
  provider: EmbedProvider
  /** Готовый src для iframe. Уже нормализован и проверен. */
  src: string
  aspect: EmbedAspect
}

/**
 * Точные хосты, никаких суффиксных проверок.
 *
 * Суффиксное сравнение (`host.endsWith('vk.com')`) пропустило бы `evil-vk.com`
 * — классическая ошибка в такого рода списках.
 */
const VK_HOSTS = new Set([
  'vk.com',
  'www.vk.com',
  'm.vk.com',
  'vk.ru',
  'www.vk.ru',
  'm.vk.ru',
  'vkvideo.ru',
  'www.vkvideo.ru',
  'vkvideo.com',
  'www.vkvideo.com',
])

const DZEN_HOSTS = new Set(['dzen.ru', 'www.dzen.ru', 'zen.yandex.ru', 'www.zen.yandex.ru'])

/** Хост VK, который используем в собранной ссылке, если исходный неизвестен. */
const VK_DEFAULT_HOST = 'vk.com'

/** `hash` у VK — hex-строка. Проверяем набор символов, чтобы не тащить мусор в URL. */
const VK_HASH_RE = /^[a-f0-9]{6,64}$/i

/** `vk.com/video-217576166_456247784` и `…/clip-…_…` */
const VK_PATH_RE = /^\/(video|clip)(-?\d+)_(\d+)/

/**
 * `src` из вставленного кода `<iframe …>`.
 *
 * `(?<![-\w])src` — чтобы не поймать `data-src`, который у некоторых площадок
 * идёт раньше настоящего атрибута. Второй вариант — значение без кавычек:
 * так тоже иногда генерируют код вставки.
 */
const IFRAME_SRC_RE = /<iframe[^>]*?\s(?<![-\w])src\s*=\s*(?:["']([^"']+)["']|([^\s"'>]+))/i

/**
 * Разобрать пользовательский ввод: ссылку ИЛИ код вставки.
 * Возвращает null, если это не поддерживаемый провайдер.
 */
export function parseVideoEmbed(input: string): ParsedEmbed | null {
  const raw = (input || '').trim()
  if (!raw) return null

  // Код вставки → достаём src; иначе считаем ввод самой ссылкой.
  const fromIframe = IFRAME_SRC_RE.exec(raw)
  const rawSrc = fromIframe ? (fromIframe[1] ?? fromIframe[2] ?? '') : raw
  const candidate = fromIframe ? decodeHtmlEntities(rawSrc.trim()) : raw

  const url = toHttpsUrl(candidate)
  if (!url) return null

  if (VK_HOSTS.has(url.hostname)) return parseVk(url)
  if (DZEN_HOSTS.has(url.hostname)) return parseDzen(url)
  return null
}

/** URL с обязательным http(s). http поднимаем до https, прочие схемы отвергаем. */
function toHttpsUrl(value: string): URL | null {
  let candidate = value
  // Протокол-относительная ссылка `//vk.com/…` встречается в кодах вставки.
  if (candidate.startsWith('//')) candidate = `https:${candidate}`
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }
  if (url.protocol === 'http:') url.protocol = 'https:'
  if (url.protocol !== 'https:') return null // javascript:, data:, file: и т.п.

  // Логин/пароль в адресе субресурса браузеры и так не принимают — плеер
  // просто не загрузится. Вырезаем, чтобы не хранить мусор и не путать
  // сравнение хоста при чтении глазами.
  url.username = ''
  url.password = ''
  // Нестандартный порт у этих площадок не используется: либо опечатка, либо
  // попытка увести запрос. Белый список — по хосту, порт он не покрывает.
  if (url.port) return null

  return url
}

function parseVk(url: URL): ParsedEmbed | null {
  const host = VK_HOSTS.has(url.hostname) ? url.hostname : VK_DEFAULT_HOST

  // 1) Готовый embed: /video_ext.php?oid=…&id=…&hash=…
  if (url.pathname === '/video_ext.php') {
    const oid = intParam(url, 'oid')
    const id = intParam(url, 'id')
    if (oid == null || id == null) return null
    const hash = url.searchParams.get('hash')
    return {
      provider: 'vk',
      src: buildVkSrc(host, oid, id, hash),
      // Из готового кода понять клип это или обычное видео нельзя —
      // считаем горизонтальным, автор при желании переключит.
      aspect: '16:9',
    }
  }

  // 2) Обычная ссылка: /video-217576166_456247784 или /clip-…_…
  const m = VK_PATH_RE.exec(url.pathname)
  if (m) {
    const kind = m[1]
    const oid = Number(m[2])
    const id = Number(m[3])
    if (!Number.isInteger(oid) || !Number.isInteger(id)) return null
    // Хеша в обычной ссылке нет — приватное видео так не встроится.
    return {
      provider: kind === 'clip' ? 'vk-clip' : 'vk',
      src: buildVkSrc(host, oid, id, null),
      aspect: kind === 'clip' ? '9:16' : '16:9',
    }
  }

  return null
}

function buildVkSrc(host: string, oid: number, id: number, hash: string | null): string {
  const qs = new URLSearchParams({ oid: String(oid), id: String(id) })
  if (hash && VK_HASH_RE.test(hash)) qs.set('hash', hash)
  // hd=2 — просим качество повыше; js_api не используем.
  qs.set('hd', '2')
  return `https://${host}/video_ext.php?${qs.toString()}`
}

function parseDzen(url: URL): ParsedEmbed | null {
  // Готовый embed из кода вставки — берём как есть, хост уже проверен.
  // Именно этот путь основной: публичного описания формата у Дзена нет.
  if (url.pathname.startsWith('/embed/')) {
    return { provider: 'dzen', src: url.toString(), aspect: '16:9' }
  }

  // Ссылка на страницу видео — конвертируем «на лучших основаниях».
  // Если Дзен поменяет схему, сработает путь выше (код вставки).
  const watch = /^\/video\/watch\/([\w-]+)/.exec(url.pathname)
  if (watch) {
    return { provider: 'dzen', src: `https://dzen.ru/embed/${watch[1]}`, aspect: '16:9' }
  }

  return null
}

function intParam(url: URL, name: string): number | null {
  const raw = url.searchParams.get(name)
  if (raw == null || raw.trim() === '') return null
  const n = Number(raw)
  return Number.isInteger(n) ? n : null
}

/** В атрибутах кода вставки амперсанды часто экранированы. */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

/** Человеческое имя провайдера — для студии и подписей. */
export const EMBED_PROVIDER_LABEL: Record<EmbedProvider, string> = {
  vk: 'VK Видео',
  'vk-clip': 'VK Клип',
  dzen: 'Дзен',
}
