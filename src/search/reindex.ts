/**
 * Bootstrap / recovery full reindex (manual CLI).
 *
 *   npx tsx src/search/reindex.ts                              (local, reads .env)
 *   DATABASE_URL="$PROD_DB" MEILI_HOST=... MEILI_MASTER_KEY=... \
 *     npx tsx src/search/reindex.ts                            (prod, if Meili reachable)
 *
 * NOTE: on Timeweb App Platform the app rebuilds the index on boot automatically
 * (see plugin.ts), so this manual script is mainly for local dev / recovery.
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../payload.config'
import { reindexAll } from './reindex-core'

async function run(): Promise<void> {
  const payload = await getPayload({ config })
  const n = await reindexAll(payload)
  payload.logger.info(`[reindex] done: ${n} docs`)
  process.exit(0)
}

run().catch((err) => {
  console.error('[reindex] failed', err)
  process.exit(1)
})
