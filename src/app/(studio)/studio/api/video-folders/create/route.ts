import { makeFolderCreateRoute } from '@/app/(studio)/studio/api/_folderRoutes'

/**
 * Создание папки видео.
 *
 * Body: { title, parentId? }. slug генерится из title и делается уникальным
 * в пределах (тенант + родитель) — beforeValidate коллекции запрещает дубли
 * на одном уровне.
 *
 * Логика общая для папок видео и галереи — см. _folderRoutes.ts.
 */
export const POST = makeFolderCreateRoute({ folders: 'video-folders', items: 'videos', itemsGenitive: 'видео' })
