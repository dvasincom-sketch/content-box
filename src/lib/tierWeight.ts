/**
 * Вес уровня подписки по id — общий хелпер для гейтинга публикаций и видео
 * (раньше дословно дублировался в publicationAccess.ts и videoAccess.ts).
 *
 * «Подход Б»: вес дочитывается из БД по id, а не берётся из populate — так его
 * нельзя подменить через depth в запросе auth().
 *
 * `tenantId` обязателен: веса тарифов — обычные числа без пространства имён,
 * поэтому тариф чужого тенанта с тем же весом открывал бы платный контент.
 * Тариф не своего тенанта трактуется как несуществующий (null).
 */
export async function tierWeight(
  payload: any,
  tierId: string | number,
  tenantId: string | number,
): Promise<number | null> {
  try {
    const t = await payload.findByID({
      collection: 'subscription-tiers',
      id: tierId,
      depth: 0,
      overrideAccess: true,
    })
    if (!t) return null

    const owner = t.tenant == null ? null : String(typeof t.tenant === 'object' ? t.tenant.id : t.tenant)
    if (owner !== String(tenantId)) {
      // Осиротевший тариф (tenant_id NULL после ON DELETE SET NULL) или тариф
      // чужого тенанта. Отказываем, но НЕ молча: иначе платящий подписчик
      // упирается в пейволл без единого следа в логах.
      console.warn(
        `[tierWeight] тариф ${tierId} не принадлежит тенанту ${tenantId} (владелец: ${owner ?? 'null'}) — доступ закрыт`,
      )
      return null
    }

    // `weight` в Postgres — numeric, драйвер может вернуть его строкой.
    const w = Number(t.weight)
    return Number.isFinite(w) ? w : null
  } catch {
    return null
  }
}
