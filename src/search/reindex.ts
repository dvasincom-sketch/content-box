/**
 * Bootstrap / recovery full reindex.
 *
 *   npx tsx src/search/reindex.ts                              (local, reads .env)
 *   DATABASE_URL="$PROD_DB" MEILI_HOST=... MEILI_MASTER_KEY=... \
 *     npx tsx src/search/reindex.ts                            (prod)
 *
 * `import 'dotenv/config'` loads .env (tsx doesn't do it automatically) — same
 * pattern as the other scripts in src/scripts.
 * Idempotent: recreates settings and upserts every doc. Safe to re-run.
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import { ensureSearchIndex, contentIndex } from './meili'
import { INDEXED_COLLECTIONS, mapDoc } from './map'

async function run(): Promise<void> {
  const payload = await getPayload({ config })

  await ensureSearchIndex()
  const index = contentIndex()

  for (const slug of INDEXED_COLLECTIONS) {
    let page = 1
    let indexed = 0

    for (;;) {
      const res = await payload.find({
        collection: slug as never,
        page,
        limit: 200,
        depth: 0,
        overrideAccess: true,
      })

      const mapped = await Promise.all(
        res.docs.map((d) => mapDoc(payload, slug, d)),
      )
      const docs = mapped.filter((d): d is NonNullable<typeof d> => d !== null)

      if (docs.length > 0) {
        const task = await index.updateDocuments(docs).waitTask()
        if (task.status !== 'succeeded') {
          // Surface rejected batches instead of silently miscounting.
          throw new Error(
            `[reindex] ${slug} batch failed: ${task.status} — ${JSON.stringify(task.error)}`,
          )
        }
        indexed += docs.length
      }

      payload.logger.info(`[reindex] ${slug}: ${indexed}/${res.totalDocs}`)
      if (!res.hasNextPage) break
      page++
    }
  }

  payload.logger.info('[reindex] done')
  process.exit(0)
}

run().catch((err) => {
  console.error('[reindex] failed', err)
  process.exit(1)
})
