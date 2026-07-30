import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { PgPool } from '@/lib/sql'

/**
 * Health-check для оркестратора (HEALTHCHECK в Dockerfile, проба Timeweb).
 *
 * Проверяет не «процесс жив», а «приложение отвечает и видит базу» — иначе
 * контейнер с недоступным Postgres выглядит здоровым и продолжает получать
 * трафик. Запрос предельно дешёвый: `SELECT 1`, без обращения к коллекциям.
 *
 * Наружу не отдаём ничего диагностического: только ok/статус. Текст ошибки
 * подключения содержит хост и имя базы — в публичный ответ ему не место.
 *
 * Соседствует с catch-all роутом Payload `/api/[...slug]`: статический сегмент
 * в Next выигрывает у catch-all, как и у существующих /api/search и /api/video-token.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const payload = await getPayload({ config: await config })
    const pool = (payload.db as unknown as { pool?: PgPool }).pool
    // Нет пула — считаем это нездоровьем, а не поводом отрапортовать ok:
    // иначе проба зелёная у контейнера, который до базы не дотягивается.
    if (!pool?.query) return NextResponse.json({ ok: false }, { status: 503 })
    await pool.query('SELECT 1')
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
