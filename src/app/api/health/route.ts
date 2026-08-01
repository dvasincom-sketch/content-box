import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { PgPool } from '@/lib/sql'

/**
 * Health-check для оркестратора (HEALTHCHECK в Dockerfile + проба Timeweb).
 *
 * Проверяет «приложение отвечает и видит базу». ВАЖНО про поведение под нагрузкой:
 * при бёрсте одновременных SSR-рендеров пул соединений (max) бывает ВРЕМЕННО
 * исчерпан, и `SELECT 1` ждёт свободного клиента. Это НЕ повод убивать живой
 * контейнер — убийство под нагрузкой запускает рестарт-цикл и 502. Поэтому:
 * короткий дедлайн на пробу; если не успели ИЗ-ЗА занятого пула, но у пула есть
 * живые соединения (БД достижима) — рапортуем ok. 503 только когда пула нет,
 * проба вернула ошибку, или пул реально пуст (БД недоступна).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const payload = await getPayload({ config: await config })
    const pool = (payload.db as unknown as { pool?: PgPool & { totalCount?: number } }).pool
    if (!pool?.query) return NextResponse.json({ ok: false }, { status: 503 })

    const probe: Promise<'ok' | 'err'> = pool.query('SELECT 1').then(
      () => 'ok',
      () => 'err',
    )
    const deadline = new Promise<'busy'>((resolve) => setTimeout(() => resolve('busy'), 2500))
    const result = await Promise.race([probe, deadline])

    if (result === 'ok') return NextResponse.json({ ok: true })
    if (result === 'err') return NextResponse.json({ ok: false }, { status: 503 })

    // 'busy': проба не уложилась в дедлайн — пул занят под нагрузкой. Контейнер
    // здоров, если у пула есть открытые соединения (значит БД достижима).
    const total = Number(pool.totalCount ?? 0)
    return total > 0
      ? NextResponse.json({ ok: true, note: 'db-busy' })
      : NextResponse.json({ ok: false }, { status: 503 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
