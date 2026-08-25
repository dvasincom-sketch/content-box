import { NextResponse } from 'next/server'

/**
 * Устарело: параметры boost (пресет, маржа, реплики, образ) правит суперадмин в
 * Payload-админке (коллекция «Boost-настройки»), а не автор в студии. Эндпоинт
 * оставлен инертным, чтобы не ломать сборку; можно удалить папку позже.
 */
export function POST(): Response {
  return NextResponse.json({ error: 'Настройки boost перенесены в админку' }, { status: 410 })
}
