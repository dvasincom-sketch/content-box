import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { isHomeSectionType, type HomeSectionType } from '@/lib/homeSections'

/**
 * Сохранение конфигурации секций главной. SiteSettings — одна запись на тенант
 * (isGlobal через multi-tenant плагин). Находим её по tenant, обновляем массив
 * homeSections (порядок + видимость секций главной страницы).
 *
 * Body: { homeSections: [{ type, enabled }] }
 * type ∈ HOME_SECTION_TYPES (валидируем через isHomeSectionType).
 * Пустой массив допустим — на чтении он означает «дефолт» (все секции в
 * стандартном порядке, см. normalizeHomeSections), т.е. это способ сброса.
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

  const rawSections = Array.isArray(data.homeSections) ? data.homeSections : []
  // валидация и очистка
  const homeSections: { type: HomeSectionType; enabled: boolean }[] = []
  const seen = new Set<HomeSectionType>()
  for (const s of rawSections) {
    const type = s?.type
    if (!isHomeSectionType(type)) {
      return NextResponse.json({ error: `Неизвестная секция: ${String(type)}` }, { status: 400 })
    }
    if (seen.has(type)) {
      return NextResponse.json({ error: `Дубликат секции: ${type}` }, { status: 400 })
    }
    seen.add(type)
    homeSections.push({ type, enabled: Boolean(s?.enabled) })
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
      data: { homeSections } as any,
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
