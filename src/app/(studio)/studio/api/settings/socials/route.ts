import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Сохранение соцсетей. SiteSettings — одна запись на тенант (isGlobal через
 * multi-tenant плагин). Находим её по tenant, обновляем массив socials.
 *
 * Body: { socials: [{ platform, url }] }
 * platform ∈ boosty|vk|telegram|youtube|instagram (валидируем).
 */

const PLATFORMS = ['boosty', 'vk', 'telegram', 'youtube', 'instagram']

export async function POST(req: NextRequest) {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  let data: any
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 })
  }

  const rawSocials = Array.isArray(data.socials) ? data.socials : []
  // валидация и очистка
  const socials: { platform: string; url: string }[] = []
  for (const s of rawSocials) {
    const platform = String(s?.platform || '').trim()
    const url = String(s?.url || '').trim()
    if (!PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: `Неизвестная площадка: ${platform}` }, { status: 400 })
    }
    if (!url) {
      return NextResponse.json({ error: 'У каждой соцсети должна быть ссылка' }, { status: 400 })
    }
    socials.push({ platform, url })
  }

  const payload = await getPayload({ config: await config })
  const settings = await findSettings(payload, author.tenantId)
  if (!settings) {
    return NextResponse.json({ error: 'Настройки сайта не найдены' }, { status: 404 })
  }

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      data: { socials } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось сохранить' },
      { status: 400 },
    )
  }
}

/** Единственная запись site-settings тенанта. */
async function findSettings(payload: any, tenantId: number) {
  const res = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs[0] || null
}
