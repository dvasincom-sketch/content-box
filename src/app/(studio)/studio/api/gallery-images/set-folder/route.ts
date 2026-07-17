import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Назначить / снять папку у изображения галереи.
 *
 * Body: { imageId, folderId }
 *  - folderId: число → положить изображение в эту папку (папка проверяется на тенант)
 *              null / '' → вынуть из папки (folder → null)
 *
 * Одно видео = одна папка, поэтому просто перезаписываем поле folder.
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

  const imageId = data.imageId
  if (!imageId) return NextResponse.json({ error: 'Не указано изображение' }, { status: 400 })

  const payload = await getPayload({ config: await config })
  const tenantId = author.tenantId

  // Видео принадлежит тенанту?
  const image: any = await payload
    .findByID({ collection: 'gallery-images', id: imageId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!image) return NextResponse.json({ error: 'Изображение не найдено' }, { status: 404 })
  const vTenant =
    image.tenant && typeof image.tenant === 'object' ? image.tenant.id : image.tenant
  if (Number(vTenant) !== Number(tenantId)) {
    return NextResponse.json({ error: 'Изображение не найдено' }, { status: 404 })
  }

  // Целевая папка
  let folder: number | null = null
  if (data.folderId != null && data.folderId !== '') {
    const f: any = await payload
      .findByID({ collection: 'gallery-folders', id: data.folderId, depth: 0, overrideAccess: true })
      .catch(() => null)
    const fTenant = f && (typeof f.tenant === 'object' ? f.tenant.id : f.tenant)
    if (!f || Number(fTenant) !== Number(tenantId)) {
      return NextResponse.json({ error: 'Папка не найдена' }, { status: 400 })
    }
    folder = Number(data.folderId)
  }

  try {
    await payload.update({
      collection: 'gallery-images',
      id: imageId,
      data: { folder } as any,
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, folderId: folder })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Не удалось изменить папку изображения' },
      { status: 400 },
    )
  }
}
