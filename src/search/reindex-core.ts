import type { Payload } from 'payload'
import { ensureSearchIndex, contentIndex } from './meili'
import { INDEXED_COLLECTIONS, mapDoc } from './map'

/**
 * Full (re)index of all indexed collections. Idempotent (upsert by id).
 * Used by the CLI script AND the on-boot rebuild in plugin.ts.
 */
export async function reindexAll(payload: Payload): Promise<number> {
  await ensureSearchIndex()
  const index = contentIndex()
  let total = 0

  for (const slug of INDEXED_COLLECTIONS) {
    let page = 1
    for (;;) {
      const res = await payload.find({
        collection: slug as never,
        page,
        limit: 200,
        depth: 0,
        overrideAccess: true,
      })

      const mapped = (
        await Promise.all(res.docs.map((d) => mapDoc(payload, slug, d)))
      ).filter((d): d is NonNullable<typeof d> => d !== null)

      if (mapped.length > 0) {
        const task = await index.updateDocuments(mapped).waitTask()
        if (task.status !== 'succeeded') {
          throw new Error(
            `[reindex] ${slug} batch ${task.status}: ${JSON.stringify(task.error)}`,
          )
        }
        total += mapped.length
      }

      payload.logger.info(`[reindex] ${slug}: ${total}`)
      if (!res.hasNextPage) break
      page++
    }
  }

  return total
}

/** Current document count in the index (0 = empty / needs rebuild). */
export async function indexDocCount(): Promise<number> {
  const res = await contentIndex().search('', { limit: 0 })
  return (res as any).estimatedTotalHits ?? (res as any).totalHits ?? 0
}
