import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from 'payload'
import { contentIndex } from './meili'
import { mapDoc, indexId } from './map'

/**
 * Payload hooks that keep the Meilisearch index in sync.
 *
 * Design rule: indexing NEVER blocks or breaks a CMS write. Any Meili error is
 * logged and swallowed — a search-index hiccup must not stop editors from saving.
 */

export function makeAfterChange(collectionSlug: string): CollectionAfterChangeHook {
  return async ({ doc, req }) => {
    try {
      const mapped = await mapDoc(req.payload, collectionSlug, doc)
      if (mapped) {
        await contentIndex().updateDocuments([mapped]) // upsert by primaryKey `id`
      } else {
        await contentIndex()
          .deleteDocument(indexId(collectionSlug, doc.id))
          .catch(() => undefined)
      }
    } catch (err) {
      req.payload.logger.error(
        { err },
        `[search] index upsert failed for ${collectionSlug}:${doc?.id}`,
      )
    }
    return doc
  }
}

export function makeAfterDelete(collectionSlug: string): CollectionAfterDeleteHook {
  return async ({ id, req }) => {
    try {
      await contentIndex().deleteDocument(indexId(collectionSlug, id))
    } catch (err) {
      req.payload.logger.error(
        { err },
        `[search] index delete failed for ${collectionSlug}:${id}`,
      )
    }
  }
}
