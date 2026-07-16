import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Смена собственного пароля. Меняем ТОЛЬКО аккаунт из сессии — id берём из
 * getCurrentAuthor, не из тела запроса (иначе можно было бы сменить чужой).
 *
 * Перед сменой проверяем текущий пароль через payload.login — так автор не
 * сможет сменить пароль по «забытой» открытой сессии без знания старого.
 *
 * Body: { currentPassword, newPassword }
 */
export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let data: any
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  const currentPassword = String(data.currentPassword || '')
  const newPassword = String(data.newPassword || '')

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Заполните оба поля' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Новый пароль — минимум 8 символов' }, { status: 400 })
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: 'Новый пароль совпадает со старым' }, { status: 400 })
  }

  const payload = await getPayload({ config: await config })
  const email = author.user.email

  // Проверка текущего пароля
  try {
    await payload.login({
      collection: 'users',
      data: { email, password: currentPassword },
    })
  } catch {
    return NextResponse.json({ error: 'Текущий пароль неверный' }, { status: 400 })
  }

  // Смена пароля своего аккаунта
  try {
    await payload.update({
      collection: 'users',
      id: author.user.id,
      data: { password: newPassword } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось сменить пароль' },
      { status: 400 },
    )
  }
}
