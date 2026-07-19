import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Чтение секции «Hero» (заголовок главной) для редактора в студии.
 * Возвращает тексты (eyebrow, titleLines) + выбранные чипсы (heroChips) в
 * текущем порядке с id/title/coverUrl (для верхнего dnd-списка панели, как у
 * категорий-плиток). Полный список категорий (дерево+поиск) панель берёт из
 * /studio/api/settings/categories-list.
 *
 * depth: 1 — чтобы heroChips пришли объектами (id/title/cover).
 * titleLines отдаём как есть (сырая строка textarea с \n) — панель покажет в поле.
 *
 * Ответ: { ok, hero: { eyebrow, titleLines }, chips: [{ id, title, coverUrl }] } | { error }
 */

export async function GET() {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await getPayload({ config: await config })

  const res = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: author.tenantId } },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })
  const settings = res.docs[0] as any
  if (!settings) {
    return NextResponse.json({ error: 'Настройки сайта не найдены' }, { status: 404 })
  }

  const hero = settings.hero || {}

  const rawChips = Array.isArray(settings.heroChips) ? settings.heroChips : []
  const chips = rawChips
    .filter((c: any) => c && typeof c === 'object')
    .map((c: any) => {
      const cover = c.cover
      const coverUrl = cover && typeof cover === 'object' ? (cover.url ?? null) : null
      return { id: c.id, title: c.title ?? '', coverUrl }
    })

  return NextResponse.json({
    ok: true,
    hero: {
      eyebrow: hero.eyebrow ?? '',
      titleLines: hero.titleLines ?? '',
    },
    chips,
  })
}
