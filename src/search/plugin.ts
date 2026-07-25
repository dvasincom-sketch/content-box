import type { Config, Plugin } from 'payload'
import { INDEXED_COLLECTIONS } from './map'
import { makeAfterChange, makeAfterDelete } from './hooks'
import { ensureSearchIndex } from './meili'

/**
 * Payload plugin that wires everything up automatically:
 *  - attaches afterChange/afterDelete sync hooks to every indexed collection
 *    (merging with any existing hooks),
 *  - ensures the Meili index + settings exist on boot (onInit).
 *
 * Usage in payload.config.ts:
 *   import { meiliSearchPlugin } from '@/search/plugin'
 *   export default buildConfig({ plugins: [meiliSearchPlugin()], ... })
 *
 * With this plugin you don't need to add `searchHooks(...)` to collections by hand.
 */
export function meiliSearchPlugin(): Plugin {
  return (incoming: Config): Config => {
    const config: Config = { ...incoming }

    config.collections = (config.collections ?? []).map((col) => {
      if (!INDEXED_COLLECTIONS.includes(col.slug)) return col
      return {
        ...col,
        hooks: {
          ...col.hooks,
          afterChange: [...(col.hooks?.afterChange ?? []), makeAfterChange(col.slug)],
          afterDelete: [...(col.hooks?.afterDelete ?? []), makeAfterDelete(col.slug)],
        },
      }
    })

    const prevOnInit = config.onInit
    config.onInit = async (payload) => {
      if (prevOnInit) await prevOnInit(payload)
      try {
        await ensureSearchIndex()
        payload.logger.info('[search] Meilisearch index ready')
      } catch (err) {
        // Don't crash boot if Meili is briefly unavailable; hooks will retry on next write.
        payload.logger.error({ err }, '[search] ensureSearchIndex failed on init')
      }
    }

    return config
  }
}
