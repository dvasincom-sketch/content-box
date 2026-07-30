/**
 * Теги кэша. Отдельный модуль БЕЗ зависимостей — намеренно.
 *
 * Тег нужен и тому, кто кэширует (lib/homeFeed), и тому, кто сбрасывает
 * (хуки коллекций). Если держать его в homeFeed.ts, получается цикл:
 * payload.config → Publications → revalidateHome → homeFeed → payload.config.
 * Сейчас он не проявляется, но втягивать конфиг Payload и внутренности Next
 * в граф импортов коллекций незачем.
 */

/** Кэш ленты главной одного тенанта. */
export function homeFeedTag(tenantId: string | number): string {
  return `home:${tenantId}`
}
