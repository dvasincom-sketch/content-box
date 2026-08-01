import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'

/**
 * ВРЕМЕННЫЙ диагностический эндпоинт (убрать после расследования рестарт-цикла).
 * Отдаёт потребление памяти процессом и РЕАЛЬНЫЙ лимит памяти контейнера из
 * cgroup — чтобы понять, убивает ли контейнер OOM (rss/current растёт к max) или
 * что-то внешнее (память низкая, лимит большой). Без БД, легковесный.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function readCg(paths: string[]): string | null {
  for (const p of paths) {
    try {
      return readFileSync(p, 'utf8').trim()
    } catch {
      /* след. путь */
    }
  }
  return null
}

const MB = (n: number | string | null): number | string | null => {
  if (n === null || n === 'max') return n
  const v = Number(n)
  return Number.isFinite(v) ? Math.round(v / 1048576) : null
}

export async function GET() {
  const m = process.memoryUsage()
  const max = readCg(['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes'])
  const cur = readCg(['/sys/fs/cgroup/memory.current', '/sys/fs/cgroup/memory/memory.usage_in_bytes'])
  return NextResponse.json(
    {
      uptimeSec: Math.round(process.uptime()),
      rssMB: MB(m.rss),
      heapUsedMB: MB(m.heapUsed),
      heapTotalMB: MB(m.heapTotal),
      externalMB: MB(m.external),
      cgroupLimitMB: MB(max),
      cgroupCurrentMB: MB(cur),
      node: process.version,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
