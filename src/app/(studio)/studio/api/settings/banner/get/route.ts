import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Чтение текстов баннера «ON AIR» (banner) для редактора в студии.
 * SiteSettings — одна запись на тенант. Тексты отдаём как есть; пустые значения
 * на фронте заменяются дефолтом (мягкий фолбэк в page.tsx).
 *
 * Ответ: { ok, banner: { tagline, onAirText } } | { error }
 */

export async function GET() {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await getPayload({ config: await config })

  const res = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: author.tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const settings = res.docs[0] as any
  if (!settings) {
    return NextResponse.json({ error: 'Настройки сайта не найдены' }, { status: 404 })
  }

  const banner = settings.banner || {}

  return NextResponse.json({
    ok: true,
    banner: {
      tagline: banner.tagline ?? '',
      onAirText: banner.onAirText ?? '',
    },
  })
}
