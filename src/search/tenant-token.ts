import { generateTenantToken } from 'meilisearch/token'
import { SEARCH_INDEX } from './meili'

/**
 * OPTIONAL — pattern (b): browser talks to Meilisearch directly for instant
 * typeahead, using a per-tenant token that can ONLY search this tenant's docs.
 * Even a forged request can't escape the tenant filter baked into the token.
 *
 * You do NOT need this for Phase 1 — the /api/search route (pattern a) already
 * scopes by tenant server-side.
 *
 * v0.60: `generateTenantToken` is a standalone import from 'meilisearch/token'
 * and takes a single options object. It must run server-side only.
 *
 * Requires a search-ONLY Meili API key (never the master key):
 *   MEILI_SEARCH_KEY_UID = uid of that key
 *   MEILI_SEARCH_KEY     = the key value
 */
export async function tenantSearchToken(
  tenantId: string,
  opts?: { expiresInSeconds?: number },
): Promise<string> {
  const apiKeyUid = process.env.MEILI_SEARCH_KEY_UID
  const apiKey = process.env.MEILI_SEARCH_KEY
  if (!apiKeyUid || !apiKey) {
    throw new Error('[search] MEILI_SEARCH_KEY_UID / MEILI_SEARCH_KEY are not set')
  }

  return generateTenantToken({
    apiKey,
    apiKeyUid,
    searchRules: {
      [SEARCH_INDEX]: { filter: `tenant = "${tenantId}"` },
    },
    expiresAt: new Date(Date.now() + (opts?.expiresInSeconds ?? 3600) * 1000),
  })
}
