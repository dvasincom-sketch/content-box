import type { CollectionSlug, Payload } from 'payload'
import { withAuthor, readJson, apiError, apiOk, belongsToTenant, tenantIdOf } from './_lib'
import { slugify } from '@/lib/slugify'
import { errorMessage } from '@/lib/errorMessage'

/**
 * Общие роуты древовидных папок (nestedDocs, tenant-scoped).
 *
 * `video-folders/*` и `gallery-folders/*` были дословными клонами: три пары
 * файлов, 263 строки, и вся разница — слаг коллекции да слово «видео» против
 * «изображения» в сообщениях. Любая правка приходилось делать дважды, а забыть
 * второй экземпляр — легко (расхождения так и накапливаются).
 *
 * Семантика сохранена ровно та же, включая коды ответов:
 *  - create: slug из title, уникальный в паре (тенант + родитель);
 *  - update: переименование и перенос, с защитой от цикла и от вложения в себя;
 *  - delete: подпапки блокируют удаление (409), содержимое НЕ удаляется —
 *    у него снимается `folder`, батчами по 100.
 *
 * Файл не `route.ts`, поэтому Next его не маршрутизирует.
 */

export type FolderRoutesConfig = {
  /** Коллекция самих папок, напр. 'video-folders'. */
  folders: CollectionSlug
  /** Коллекция содержимого, у которого есть поле `folder`, напр. 'videos'. */
  items: CollectionSlug
  /** Родительный падеж для сообщений: «Не удалось открепить <…> из папки». */
  itemsGenitive: string
}

const BATCH = 100
const MAX_DEPTH = 100

export function makeFolderCreateRoute(cfg: FolderRoutesConfig) {
  return withAuthor(async ({ req, payload, tenantId }) => {
    const data = await readJson(req)
    if (data === undefined) return apiError('Некорректный запрос')

    const title = String(data.title || '').trim()
    if (!title) return apiError('Укажите название папки')

    // Родитель (если задан) — проверяем принадлежность тенанту
    let parentId: number | null = null
    if (data.parentId != null && data.parentId !== '') {
      const ok = await belongsToTenant(payload, cfg.folders, data.parentId, tenantId)
      if (!ok) return apiError('Родительская папка не найдена')
      parentId = Number(data.parentId)
    }

    const baseSlug = slugify(title) || 'folder'
    const slug = await ensureUniqueSlug(payload, cfg.folders, tenantId, parentId, baseSlug)

    try {
      const doc = await payload.create({
        collection: cfg.folders,
        data: {
          title,
          slug,
          tenant: tenantId,
          ...(parentId ? { parent: parentId } : {}),
        } as any,
        overrideAccess: true,
      })
      return apiOk({ id: doc.id, title, slug })
    } catch (e: unknown) {
      return apiError(errorMessage(e, 'Не удалось создать папку'), 500)
    }
  })
}

export function makeFolderUpdateRoute(cfg: FolderRoutesConfig) {
  return withAuthor(async ({ req, payload, tenantId }) => {
    const data = await readJson(req)
    if (data === undefined) return apiError('Некорректный запрос')

    const id = data.id
    if (!id) return apiError('Не указана папка')

    const existing = await findOwnFolder(payload, cfg.folders, id, tenantId)
    if (!existing) return apiError('Папка не найдена', 404)

    const patch: any = {}

    if (typeof data.title === 'string') {
      const title = data.title.trim()
      if (!title) return apiError('Укажите название папки')
      // slug НЕ трогаем: он мог уже попасть в связи и в URL.
      patch.title = title
    }

    if ('parentId' in data) {
      if (data.parentId == null || data.parentId === '') {
        patch.parent = null // поднять в корень
      } else {
        const newParentId = Number(data.parentId)
        if (newParentId === Number(id)) {
          return apiError('Нельзя вложить папку саму в себя')
        }
        const okParent = await belongsToTenant(payload, cfg.folders, newParentId, tenantId)
        if (!okParent) return apiError('Родительская папка не найдена')

        const cycle = await isDescendantOf(payload, cfg.folders, newParentId, Number(id), tenantId)
        if (cycle) return apiError('Нельзя переместить папку внутрь её же подпапки')

        patch.parent = newParentId
      }
    }

    if (Object.keys(patch).length === 0) return apiOk() // нечего менять

    try {
      await payload.update({ collection: cfg.folders, id, data: patch, overrideAccess: true })
      return apiOk()
    } catch (e: unknown) {
      return apiError(errorMessage(e, 'Не удалось сохранить папку'))
    }
  })
}

export function makeFolderDeleteRoute(cfg: FolderRoutesConfig) {
  return withAuthor(async ({ req, payload, tenantId }) => {
    const data = await readJson(req)
    if (data === undefined) return apiError('Некорректный запрос')

    const id = data.id
    if (!id) return apiError('Не указана папка')

    const existing = await findOwnFolder(payload, cfg.folders, id, tenantId)
    if (!existing) return apiError('Папка не найдена', 404)

    // 1) Есть ли подпапки? Если да — запрещаем удаление.
    const children = await payload.find({
      collection: cfg.folders,
      where: { and: [{ tenant: { equals: tenantId } }, { parent: { equals: Number(id) } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (children.totalDocs > 0) {
      return apiError('Сначала удалите или переместите вложенные папки', 409)
    }

    // 2) Открепляем содержимое (folder → null). Батчами.
    try {
      for (;;) {
        const batch = await payload.find({
          collection: cfg.items,
          where: { and: [{ tenant: { equals: tenantId } }, { folder: { equals: Number(id) } }] },
          limit: BATCH,
          depth: 0,
          overrideAccess: true,
        })
        if (batch.docs.length === 0) break
        for (const item of batch.docs as any[]) {
          await payload.update({
            collection: cfg.items,
            id: item.id,
            data: { folder: null } as any,
            overrideAccess: true,
          })
        }
        if (batch.docs.length < BATCH) break
      }
    } catch (e: unknown) {
      return apiError(errorMessage(e, `Не удалось открепить ${cfg.itemsGenitive} из папки`), 500)
    }

    // 3) Удаляем саму папку
    try {
      await payload.delete({ collection: cfg.folders, id, overrideAccess: true })
      return apiOk()
    } catch (e: unknown) {
      return apiError(errorMessage(e, 'Не удалось удалить папку'), 500)
    }
  })
}

/** Папка, если она существует И принадлежит тенанту. Иначе null. */
async function findOwnFolder(
  payload: Payload,
  collection: CollectionSlug,
  id: string | number,
  tenantId: number,
): Promise<any | null> {
  const doc = await payload
    .findByID({ collection, id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!doc) return null
  return tenantIdOf(doc) === Number(tenantId) ? doc : null
}

/** Уникальный slug в пределах тенанта и одного родителя: folder, folder-2… */
async function ensureUniqueSlug(
  payload: Payload,
  collection: CollectionSlug,
  tenantId: number,
  parentId: number | null,
  base: string,
): Promise<string> {
  let candidate = base
  let n = 1
  while (n < MAX_DEPTH) {
    const res = await payload.find({
      collection,
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { slug: { equals: candidate } },
          parentId ? { parent: { equals: parentId } } : { parent: { exists: false } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (res.totalDocs === 0) return candidate
    n += 1
    candidate = `${base}-${n}`
  }
  return `${base}-${Date.now()}`
}

/**
 * Является ли `candidateId` потомком `ancestorId` — идём вверх по parent от
 * candidate; встретили ancestor → да. Ограничение глубины защищает от битого
 * дерева с циклом.
 */
async function isDescendantOf(
  payload: Payload,
  collection: CollectionSlug,
  candidateId: number,
  ancestorId: number,
  tenantId: number,
): Promise<boolean> {
  let currentId: number | null = candidateId
  let hops = 0
  while (currentId != null && hops < MAX_DEPTH) {
    if (currentId === ancestorId) return true
    const doc: any = await payload
      .findByID({ collection, id: currentId, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!doc) return false
    if (tenantIdOf(doc) !== Number(tenantId)) return false
    const p = doc.parent && typeof doc.parent === 'object' ? doc.parent.id : doc.parent
    currentId = p != null ? Number(p) : null
    hops += 1
  }
  return false
}
