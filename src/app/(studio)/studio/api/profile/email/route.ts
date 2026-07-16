import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Смена собственного email (= логина). Чувствительно: подтверждаем текущим
 * паролем. Меняем только аккаунт из сессии.
 *
 * Body: { newEmail, password }
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let data: any
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  const newEmail = String(data.newEmail || '').trim().toLowerCase()
  const password = String(data.password || '')

  if (!EMAIL_RE.test(newEmail)) {
    return NextResponse.json({ error: 'Некорректный email' }, { status: 400 })
  }
  if (!password) {
    return NextResponse.json({ error: 'Введите пароль для подтверждения' }, { status: 400 })
  }
  if (newEmail === author.user.email.toLowerCase()) {
    return NextResponse.json({ error: 'Это ваш текущий email' }, { status: 400 })
  }

  const payload = await getPayload({ config: await config })

  // Подтверждаем паролем
  try {
    await payload.login({
      collection: 'users',
      data: { email: author.user.email, password },
    })
  } catch {
    return NextResponse.json({ error: 'Пароль неверный' }, { status: 400 })
  }

  // Email занят?
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: newEmail } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.totalDocs > 0) {
    return NextResponse.json({ error: 'Этот email уже используется' }, { status: 409 })
  }

  try {
    await payload.update({
      collection: 'users',
      id: author.user.id,
      data: { email: newEmail } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, email: newEmail })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось сменить email' },
      { status: 400 },
    )
  }
}
