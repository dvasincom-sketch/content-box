import crypto from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { isSameOrigin, isMutating } from '@/lib/sameOrigin'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Приём приглашения: установка пароля по одноразовому токену. ПУБЛИЧНЫЙ роут
 * (без сессии), защищён самим токеном (sha256-совпадение + срок + не принято).
 * После успеха токен гасится (single-use). Логина не делаем — редирект на
 * страницу входа делает клиент.
 *
 * Body: { token, password }
 */
export const runtime = 'nodejs'

export async function POST(req: NextRequest): Promise<Response> {
  if (isMutating(req.method) && !isSameOrigin(req)) {
    return NextResponse.json({ error: 'Запрос с постороннего origin' }, { status: 403 })
  }
  let data: any
  try { data = await req.json() } catch { return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 }) }
  const token = String(data?.token || '')
  const password = String(data?.password || '')
  if (!token) return NextResponse.json({ error: 'Ссылка недействительна' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Пароль должен быть не короче 8 символов' }, { status: 400 })

  const payload = await getPayload({ config: await config })
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const res = await payload.find({
    collection: 'users', where: { inviteTokenHash: { equals: hash } }, limit: 1, depth: 0, overrideAccess: true,
  })
  const u: any = res.docs[0]
  const valid = u && !u.inviteAcceptedAt && u.inviteExpiresAt && new Date(u.inviteExpiresAt).getTime() > Date.now()
  if (!valid) return NextResponse.json({ error: 'Ссылка недействительна или истекла' }, { status: 400 })

  try {
    await payload.update({
      collection: 'users', id: u.id,
      data: { password, inviteAcceptedAt: new Date().toISOString(), inviteTokenHash: null } as any,
      overrideAccess: true,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e, 'Не удалось сохранить пароль') }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
