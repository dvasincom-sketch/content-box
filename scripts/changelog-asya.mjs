#!/usr/bin/env node
/**
 * Авточерновик записи для журнала обновлений (/update) через Asya.
 *
 * 1. Считает дату (по умолчанию — вчера) и версию ММ.ДД.К.
 * 2. Собирает коммиты дня из git.
 * 3. Отправляет их Asya (POST /generate, json:true) вместе с системным промтом
 *    scripts/changelog-asya.system.md — она возвращает готовый объект RELEASES.
 * 4. Вставляет объект в начало массива RELEASES в public/update.html.
 *
 * Если за день нет пользовательских изменений (или Asya вернула {skip:true}) —
 * файл не меняется, и workflow не открывает PR.
 *
 * Запуск в CI:
 *   ASYA_API_URL=https://api.xn--80a8a2b.online ASYA_API_KEY=*** \
 *     node scripts/changelog-asya.mjs 2026-08-10
 *
 * Локальная проверка без сети (вставка из готового JSON):
 *   node scripts/changelog-asya.mjs 2026-08-10 --fixture path/to/obj.json
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, '..')
const HTML = join(REPO, 'public', 'update.html')
const SYSTEM_FILE = join(__dirname, 'changelog-asya.system.md')

// Якорь схемы версий: какой календарный месяц считается «месяцем 1».
const ANCHOR_YEAR = 2026
const ANCHOR_MONTH = 6 // июнь 2026 = месяц 1 (июль=2, август=3, …)
const monthIndex = (y, m) => (y - ANCHOR_YEAR) * 12 + (m - ANCHOR_MONTH) + 1

// ---- аргументы -------------------------------------------------------------
const args = process.argv.slice(2)
const fixtureIdx = args.indexOf('--fixture')
const fixture = fixtureIdx >= 0 ? args[fixtureIdx + 1] : null
const dateArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))

function yesterdayISO() {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10) // TZ выставляется окружением (в CI — Europe/Moscow)
}
const date = dateArg || yesterdayISO()
const [Y, M, D] = date.split('-').map(Number)
const MM = monthIndex(Y, M)

// ---- сбор коммитов дня -----------------------------------------------------
function commitsFor(day) {
  const out = execSync(
    `git log --since="${day} 00:00" --until="${day} 23:59:59" --format=%s --no-merges`,
    { cwd: REPO, encoding: 'utf8' },
  )
  return out.split('\n').map((s) => s.trim()).filter(Boolean)
}

// ---- умное число К: следующий номер релиза для этого дня --------------------
// К = (сколько записей ММ.ДД.* уже есть в файле) + 1. Обычно 1.
function nextK(html, mm, d) {
  const re = new RegExp(`version:\\s*'${mm}\\.${d}\\.(\\d+)'`, 'g')
  let max = 0
  let m
  while ((m = re.exec(html))) max = Math.max(max, Number(m[1]))
  return max + 1
}

// ---- рендер объекта в JS-литерал в стиле файла -----------------------------
const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
function render(obj) {
  const tags = '[' + obj.tags.map(q).join(', ') + ']'
  const lines = []
  lines.push(`    { version:${q(obj.version)}, tags:${tags}, title:${q(obj.title)},`)
  lines.push(`      changes:[`)
  obj.changes.forEach((c, i) => {
    const comma = i < obj.changes.length - 1 ? ',' : ''
    lines.push(`        ${q(c)}${comma}`)
  })
  if (obj.mkt && obj.mkt.b) {
    lines.push(`      ],`)
    lines.push(`      mkt:{ h:${q(obj.mkt.h || 'Для авторов')}, b:${q(obj.mkt.b)} } },`)
  } else {
    lines.push(`      ] },`)
  }
  return lines.join('\n')
}

// ---- вызов Asya ------------------------------------------------------------
async function askAsya(system, input) {
  const base = (process.env.ASYA_API_URL || 'https://api.xn--80a8a2b.online').replace(/\/+$/, '')
  const url = base + '/generate'
  const key = process.env.ASYA_API_KEY
  if (!key) {
    throw new Error(
      'ASYA_API_KEY пуст. Проверь секрет репозитория (Settings → Secrets → Actions, имя ровно ASYA_API_KEY) ' +
        'и что шаг workflow пробрасывает его в env.',
    )
  }
  console.log(`[changelog] Запрос к Asya: ${url} (ключ найден, длина ${key.length})`)

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ system, input, json: true, maxTokens: 1200 }),
    })
  } catch (e) {
    throw new Error(`Сеть/DNS до Asya не отработали: ${e.message}`)
  }

  const bodyText = await res.text()
  const snippet = bodyText.slice(0, 500)
  console.log(`[changelog] Asya ответила HTTP ${res.status}, тело (до 500 симв.): ${snippet}`)
  if (!res.ok) throw new Error(`Asya вернула HTTP ${res.status}. Тело: ${snippet}`)

  let data
  try {
    data = JSON.parse(bodyText)
  } catch {
    throw new Error(`Ответ Asya — не JSON. Тело: ${snippet}`)
  }
  if (data.ok === false) {
    throw new Error(`Asya ok:false — error="${data.error || ''}" text="${data.text || ''}"`)
  }

  // Предпочитаем разобранный объект; иначе парсим текст из output.
  if (data.json && typeof data.json === 'object') return data.json
  const raw = (data.output || '').trim().replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim()
  if (!raw) throw new Error(`В ответе Asya нет ни json, ни output. Ключи ответа: ${Object.keys(data).join(', ')}`)
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`Не удалось разобрать JSON из output Asya. output: ${raw.slice(0, 500)}`)
  }
}

// ---- валидация объекта -----------------------------------------------------
function validate(obj) {
  const ok =
    obj &&
    typeof obj.version === 'string' &&
    Array.isArray(obj.tags) &&
    obj.tags.length > 0 &&
    obj.tags.every((t) => ['feature', 'improve', 'milestone'].includes(t)) &&
    typeof obj.title === 'string' &&
    obj.title.trim().length > 0 &&
    Array.isArray(obj.changes) &&
    obj.changes.length >= 1 &&
    obj.changes.every((c) => typeof c === 'string' && c.trim())
  if (!ok) throw new Error('Ответ Asya не прошёл валидацию: ' + JSON.stringify(obj))
}

// ---- main ------------------------------------------------------------------
const main = async () => {
  const html = readFileSync(HTML, 'utf8')
  const subjects = commitsFor(date)
  console.log(`[changelog] День ${date}, собрано коммитов: ${subjects.length}`)
  if (!subjects.length && !fixture) {
    console.log(`[changelog] За ${date} коммитов нет — пропуск (PR не будет).`)
    return
  }
  const version = `${MM}.${D}.${nextK(html, MM, D)}`

  let obj
  if (fixture) {
    obj = JSON.parse(readFileSync(fixture, 'utf8'))
  } else {
    const system = readFileSync(SYSTEM_FILE, 'utf8')
    const input =
      `Дата: ${date}\nВерсия: ${version}\nКоммиты за день:\n` +
      subjects.map((s) => '- ' + s).join('\n')
    obj = await askAsya(system, input)
  }

  if (obj && obj.skip) {
    console.log(`[changelog] Asya: пропуск (${obj.reason || 'нет пользовательских изменений'}).`)
    return
  }

  // Версию проставляем свою (детерминированную), не полагаясь на модель.
  obj.version = version
  validate(obj)

  const anchor = 'var RELEASES = [\n'
  const at = html.indexOf(anchor)
  if (at < 0) throw new Error('Не найден массив RELEASES в public/update.html')
  const insertPos = at + anchor.length
  const block = render(obj) + '\n\n'
  const updated = html.slice(0, insertPos) + block + html.slice(insertPos)
  writeFileSync(HTML, updated)
  console.log(`[changelog] Вставлена запись ${version}: ${obj.title}`)

  // Отдаём данные для тела PR (GitHub Actions).
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(
      process.env.GITHUB_OUTPUT,
      `changed=true\nversion=${version}\ntitle=${obj.title.replace(/\n/g, ' ')}\n`,
      { flag: 'a' },
    )
  }
}

main().catch((e) => {
  console.error('[changelog] Ошибка:', e.message)
  process.exit(1)
})
