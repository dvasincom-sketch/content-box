import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Сохранение категорий-плиток (homeCategories) секции «Категории» главной.
 * SiteSettings — одна запись на тенант. Порядок = порядок массива.
 *
 * Body: { categories: [id, ...] }  (id категорий — число|строка)
 *
 * Пустой массив допустим (блок «Категории» не показывается). Дубликаты
 * убираются. Чужие категории (не принадлежащие тенанту) отфильтровываются —
 * сверяем присланные id со списком категорий тенанта.
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

  const rawIds = Array.isArray(data.categories) ? data.categories : []

  // нормализуем: отбрасываем пустые, дедуплицируем (по строковому виду id),
  // сохраняя порядок первого вхождения
  const seen = new Set<string>()
  const requested: (number | string)[] = []
  for (const raw of rawIds) {
    if (raw === null || raw === undefined || raw === '') continue
    const key = String(raw)
    if (seen.has(key)) continue
    seen.add(key)
    requested.push(raw)
  }

  const payload = await getPayload({ config: await config })

  // Проверка принадлежности тенанту: берём все категории тенанта, оставляем
  // только присланные id, которые реально принадлежат ему. Порядок — как прислан.
  let allowed: (number | string)[] = requested
  if (requested.length > 0) {
    const catRes = await payload.find({
      collection: 'categories',
      where: { tenant: { equals: author.tenantId } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    const ownIds = new Set((catRes.docs as any[]).map((c) => String(c.id)))
    allowed = requested.filter((id) => ownIds.has(String(id)))
  }

  const settings = await findSettings(payload, author.tenantId)
  if (!settings) {
    return NextResponse.json({ error: 'Настройки сайта не найдены' }, { status: 404 })
  }

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      data: { homeCategories: allowed } as any,
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
