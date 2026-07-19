import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Сохранение секции «Hero» целиком: тексты (eyebrow, titleLines) + чипсы
 * (heroChips — массив id категорий). Объединённое сохранение — один POST
 * обновляет оба поля SiteSettings. SiteSettings — одна запись на тенант.
 *
 * Body: {
 *   eyebrow?: string,
 *   titleLines?: string,          // сырой textarea-текст со строками через \n
 *   chips?: [id, ...]             // id категорий-чипсов, порядок = порядок массива
 * }
 *
 * Пустые тексты допустимы (на чтении сработает мягкий фолбэк на дефолт).
 * Чужие чипсы (не принадлежащие тенанту) отфильтровываются. Дубликаты убираются.
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

  const eyebrow = typeof data.eyebrow === 'string' ? data.eyebrow : ''
  const titleLines = typeof data.titleLines === 'string' ? data.titleLines : ''

  // чипсы: отбрасываем пустые, дедуплицируем по String(id), сохраняя порядок
  const rawChips = Array.isArray(data.chips) ? data.chips : []
  const seen = new Set<string>()
  const requested: (number | string)[] = []
  for (const raw of rawChips) {
    if (raw === null || raw === undefined || raw === '') continue
    const key = String(raw)
    if (seen.has(key)) continue
    seen.add(key)
    requested.push(raw)
  }

  const payload = await getPayload({ config: await config })

  // фильтр принадлежности чипсов тенанту (как в home-categories POST)
  let allowedChips: (number | string)[] = requested
  if (requested.length > 0) {
    const catRes = await payload.find({
      collection: 'categories',
      where: { tenant: { equals: author.tenantId } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    const ownIds = new Set((catRes.docs as any[]).map((c) => String(c.id)))
    allowedChips = requested.filter((id) => ownIds.has(String(id)))
  }

  const settings = await findSettings(payload, author.tenantId)
  if (!settings) {
    return NextResponse.json({ error: 'Настройки сайта не найдены' }, { status: 404 })
  }

  try {
    await payload.update({
      collection: 'site-settings',
      id: settings.id,
      data: {
        hero: { eyebrow, titleLines },
        heroChips: allowedChips,
      } as any,
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
