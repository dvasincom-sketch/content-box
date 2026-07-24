import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

/**
 * Отписка от дайджеста по токену из письма. Тело: { token }.
 *
 * Токен глобально уникален — ищем без привязки к тенанту (overrideAccess).
 * Ставит notifyDigest=false. Токен НЕ гасим: одна и та же ссылка остаётся
 * рабочей (повторная отписка идемпотентна).
 */
export async function POST(req: NextRequest) {
  let body: { token?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос.' }, { status: 400 })
  }

  const token = (body.token || '').trim()
  if (!token) {
    return NextResponse.json({ error: 'Токен не указан.' }, { status: 400 })
  }

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const found = await payload.find({
    collection: 'subscribers',
    where: { unsubscribeToken: { equals: token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const sub = found.docs[0] as any
  if (!sub) {
    return NextResponse.json({ error: 'Ссылка недействительна.' }, { status: 400 })
  }

  try {
    await payload.update({
      collection: 'subscribers',
      id: sub.id,
      data: { notifyDigest: false } as any,
      overrideAccess: true,
    })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || 'Не удалось отписаться.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
