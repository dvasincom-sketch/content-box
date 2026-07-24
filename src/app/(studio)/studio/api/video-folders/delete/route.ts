import { withAuthor, readJson, apiError, apiOk } from '@/app/(studio)/studio/api/_lib'

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
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const id = data.id
  if (!id) return apiError('Не указана папка')

  // Папка принадлежит тенанту?
  const existing: any = await payload
    .findByID({ collection: 'video-folders', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!existing) return apiError('Папка не найдена', 404)
  const fTenant =
    existing.tenant && typeof existing.tenant === 'object' ? existing.tenant.id : existing.tenant
  if (Number(fTenant) !== Number(tenantId)) {
    return apiError('Папка не найдена', 404)
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
    return apiError('Сначала удалите или переместите вложенные папки', 409)
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
    return apiError(e?.message || 'Не удалось открепить видео из папки', 500)
  }

  // 3) Удаляем саму папку
  try {
    await payload.delete({ collection: 'video-folders', id, overrideAccess: true })
    return apiOk()
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось удалить папку', 500)
  }
})
