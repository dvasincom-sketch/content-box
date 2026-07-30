import { makeFolderDeleteRoute } from '@/app/(studio)/studio/api/_folderRoutes'

/**
 * Удаление папки видео.
 *
 * Правила: подпапки блокируют удаление (409) — сначала разберись с ними;
 * содержимое НЕ удаляется, у него снимается folder (открепляется).
 *
 * Body: { id }
 *
 * Логика общая для папок видео и галереи — см. _folderRoutes.ts.
 */
export const POST = makeFolderDeleteRoute({ folders: 'video-folders', items: 'videos', itemsGenitive: 'видео' })
