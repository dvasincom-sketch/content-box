import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Удаление папки видео.
 *
 * Правила (согласованы):
 *  - если у папки есть ПОДПАПКИ → удалять нельзя (ошибка), сначала разберись с ними;
 *  - ВИДЕО внутри папки не удаляются — у них снимается folder (открепляются),
 *    затем папка удаляется.
 *
 * Body: { id }
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

  const id = data.id
  if (!id) return NextResponse.json({ error: 'Не указана папка' }, { status: 400 })

  const payload = await getPayload({ config: await config })
  const tenantId = author.tenantId

  // Папка принадлежит тенанту?
  const existing: any = await payload
    .findByID({ collection: 'video-folders', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!existing) return NextResponse.json({ error: 'Папка не найдена' }, { status: 404 })
  const fTenant =
    existing.tenant && typeof existing.tenant === 'object' ? existing.tenant.id : existing.tenant
  if (Number(fTenant) !== Number(tenantId)) {
    return NextResponse.json({ error: 'Папка не найдена' }, { status: 404 })
  }

  // 1) Есть ли подпапки? Если да — запрещаем удаление.
  const children = await payload.find({
    collection: 'video-folders',
    where: {
      and: [{ tenant: { equals: tenantId } }, { parent: { equals: Number(id) } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (children.totalDocs > 0) {
    return NextResponse.json(
      { error: 'Сначала удалите или переместите вложенные папки' },
      { status: 409 },
    )
  }

  // 2) Открепляем видео из этой папки (folder → null). Батчами по 100.
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const vids = await payload.find({
        collection: 'videos',
        where: {
          and: [{ tenant: { equals: tenantId } }, { folder: { equals: Number(id) } }],
        },
        limit: 100,
        depth: 0,
        overrideAccess: true,
      })
      if (vids.docs.length === 0) break
      for (const v of vids.docs as any[]) {
        await payload.update({
          collection: 'videos',
          id: v.id,
          data: { folder: null } as any,
          overrideAccess: true,
        })
      }
      if (vids.docs.length < 100) break
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось открепить видео из папки' },
      { status: 500 },
    )
  }

  // 3) Удаляем саму папку
  try {
    await payload.delete({ collection: 'video-folders', id, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось удалить папку' },
      { status: 500 },
    )
  }
}
