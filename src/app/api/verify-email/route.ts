import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

/**
 * Подтверждение email подписчика по токену из письма.
 *
 * Тело: { token }. Токен глобально уникален, поэтому ищем без привязки к
 * тенанту (overrideAccess). Успех → emailVerified=true, токен гасим.
 *
 * Мягкий режим: эндпоинт не логинит и ничего не блокирует — только ставит
 * отметку о подтверждении адреса.
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
    where: { emailVerifyToken: { equals: token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const sub = found.docs[0] as any
  if (!sub) {
    return NextResponse.json(
      { error: 'Ссылка недействительна или уже использована.' },
      { status: 400 },
    )
  }

  const expiry = sub.emailVerifyExpiry ? new Date(sub.emailVerifyExpiry).getTime() : 0
  if (!expiry || expiry < Date.now()) {
    return NextResponse.json(
      { error: 'Срок действия ссылки истёк. Запросите подтверждение заново.' },
      { status: 410 },
    )
  }

  try {
    await payload.update({
      collection: 'subscribers',
      id: sub.id,
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpiry: null,
      } as any,
      overrideAccess: true,
    })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || 'Не удалось подтвердить email.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
