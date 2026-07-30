import { makeFolderUpdateRoute } from '@/app/(studio)/studio/api/_folderRoutes'

/**
 * Обновление папки галереи: переименование и/или перемещение.
 *
 * Body: { id, title?, parentId? }
 *  - title  → переименовать (slug НЕ трогаем, он мог быть в связях и в URL)
 *  - parentId: число → сделать дочерней указанной папки
 *              null   → поднять в корень
 *              отсутствует → родителя не менять
 *
 * Защита от циклов: нельзя переместить папку внутрь себя или своего потомка.
 *
 * Логика общая для папок видео и галереи — см. _folderRoutes.ts.
 */
export const POST = makeFolderUpdateRoute({ folders: 'gallery-folders', items: 'gallery-images', itemsGenitive: 'изображения' })
