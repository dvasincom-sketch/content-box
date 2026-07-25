import type { Config, Plugin } from 'payload'
import { INDEXED_COLLECTIONS } from './map'
import { makeAfterChange, makeAfterDelete } from './hooks'
import { ensureSearchIndex, isMeiliConfigured } from './meili'
import { reindexAll, indexDocCount } from './reindex-core'

/**
 * Payload plugin that wires everything up:
 *  - attaches afterChange/afterDelete sync hooks to every indexed collection,
 *  - on boot (onInit): ensures the index, and REBUILDS it if empty.
 *
 * The on-boot rebuild matters on Timeweb App Platform: Docker Compose there
 * forbids persistent volumes, so Meili's index is ephemeral (lost on redeploy/
 * restart). Since the index is fully derived from Postgres, we just rebuild it
 * on boot when empty — search self-heals after every deploy, no manual reindex.
 * (If Meili later runs with a persistent volume, the count>0 check skips the
 * rebuild, so this stays cheap.)
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
      // Нет бэкенда поиска (напр. локальная разработка без Meilisearch) —
      // тихо пропускаем инициализацию: одна строка warn вместо стека ошибки.
      if (!isMeiliConfigured()) {
        payload.logger.warn(
          '[search] MEILI_HOST / MEILI_MASTER_KEY не заданы — индексация и поиск отключены в этом окружении',
        )
        return
      }
      try {
        await ensureSearchIndex()
        const count = await indexDocCount()
        if (count === 0) {
          payload.logger.info('[search] index empty — building on boot')
          const n = await reindexAll(payload)
          payload.logger.info(`[search] indexed ${n} docs on boot`)
        } else {
          payload.logger.info(`[search] Meilisearch index ready (${count} docs)`)
        }
      } catch (err) {
        // Never crash boot if Meili is briefly unavailable.
        payload.logger.error({ err }, '[search] init failed')
      }
    }

    return config
  }
}
