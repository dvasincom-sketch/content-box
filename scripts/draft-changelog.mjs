#!/usr/bin/env node
/**
 * Черновик записи для журнала обновлений (/update).
 *
 * Считает версию ММ.ДД.К и собирает коммиты дня — заготовку, которую человек
 * (или ассистент в ежедневной задаче) причёсывает в человекочитаемые пункты
 * и вставляет объектом в начало массива RELEASES в public/update.html.
 *
 * Запуск:
 *   node scripts/draft-changelog.mjs            # за сегодня
 *   node scripts/draft-changelog.mjs 2026-08-06 # за конкретный день
 *
 * ММ — порядковый месяц разработки (якорь ниже), ДД — число, К — число коммитов
 * этого дня (прокси для «релизов дня»; при желании поправить вручную).
 * Токены/сеть не нужны — читает локальный git.
 */
import { execSync } from 'node:child_process'

// Якорь схемы версий: какой календарный месяц считается «месяцем 1».
const ANCHOR_YEAR = 2026
const ANCHOR_MONTH = 6 // июнь 2026 = месяц 1 (июль=2, август=3, …)

function monthIndex(y, m) {
  return (y - ANCHOR_YEAR) * 12 + (m - ANCHOR_MONTH) + 1
}

const arg = process.argv[2]
const date = arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : new Date().toISOString().slice(0, 10)
const [Y, M, D] = date.split('-').map(Number)

let subjects = []
try {
  const out = execSync(
    `git log --since="${date} 00:00" --until="${date} 23:59:59" --format=%s --no-merges`,
    { encoding: 'utf8' },
  )
  subjects = out.split('\n').map((s) => s.trim()).filter(Boolean)
} catch (e) {
  console.error('git log не удался:', e.message)
  process.exit(1)
}

const MM = monthIndex(Y, M)
const K = subjects.length || 1
const version = `${MM}.${D}.${K}`

// Чистим префиксы конвенции коммитов и служебный шум для заготовки пунктов.
const clean = (s) =>
  s
    .replace(/^(feat|fix|chore|refactor|docs|style|perf|test|build|ci)(\([^)]*\))?:\s*/i, '')
    .trim()

const noise = /^(wip|typo|fixup|merge|lint|format|bump|revert)\b/i
const changes = subjects
  .filter((s) => !noise.test(s))
  .map(clean)
  .filter(Boolean)

const draft = {
  version,
  tags: ['feature'],
  title: 'ЗАГОЛОВОК — сформулировать по итогам дня',
  changes: changes.slice(0, 12),
  mkt: { h: 'Для авторов', b: 'ПОЛЬЗА для авторов — одним предложением.' },
}

console.log('# Черновик записи для /update — ' + date)
console.log('# Версия ' + version + '  (месяц ' + MM + ', день ' + D + ', коммитов ' + K + ')')
console.log('# Пункты ниже — СЫРЬЁ из коммитов; переписать в пользу для авторов, без техножаргона.\n')
console.log(JSON.stringify(draft, null, 2))
console.log('\n# Все коммиты дня (' + subjects.length + '):')
subjects.forEach((s) => console.log('  - ' + s))
