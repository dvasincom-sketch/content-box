// Ожидание готовности Postgres перед `payload migrate`.
//
// На старте контейнера иногда `payload migrate` падал на подключении к БД
// (стек db-postgres/connect.ts → UnhandledPromiseRejection): внешняя база ещё
// не принимала соединения / не резолвился хост в момент запуска. Из-за `&&` в
// CMD весь старт валился, контейнер уходил в рестарт-цикл и продлевал простой.
//
// Здесь просто ждём, пока TCP-порт БД начнёт принимать соединения (это ловит
// «connection refused» и DNS-раскрутку). Полная готовность принимать запросы —
// уже забота самого migrate, но главный сбой («порт ещё закрыт») снимается.
// Никогда не блокируем навсегда: по дедлайну выходим с 0 и отдаём решение migrate.

import net from 'node:net'

const url = process.env.DATABASE_URL || ''
// postgres://user:pass@host:port/db  → берём host и port
const m = /@([^:/?@]+):(\d+)/.exec(url) || /@([^:/?@]+)/.exec(url)
const host = m ? m[1] : '127.0.0.1'
const port = m && m[2] ? Number(m[2]) : 5432

const DEADLINE_MS = 90_000
const STEP_MS = 2_000
const start = Date.now()

function tryConnect() {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port })
    const finish = (ok) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(ok)
    }
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.setTimeout(3_000, () => finish(false))
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

while (Date.now() - start < DEADLINE_MS) {
  if (await tryConnect()) {
    console.log(`[wait-for-db] ${host}:${port} принимает соединения — продолжаю`)
    process.exit(0)
  }
  console.log(`[wait-for-db] ${host}:${port} пока не отвечает, жду ${STEP_MS / 1000}с…`)
  await sleep(STEP_MS)
}

console.error('[wait-for-db] БД не открыла порт за 90с — отдаю решение migrate (не блокирую старт)')
process.exit(0)
