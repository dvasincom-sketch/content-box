import { UMAMI_SCRIPT_URL } from '@/lib/umami'

/**
 * Трекер self-hosted Umami. Рендерит <script> ТОЛЬКО когда заданы и src
 * скрипта (env UMAMI_SCRIPT_URL), и websiteId тенанта. Иначе — null (no-op),
 * поэтому компонент безопасно держать в layout до настройки Umami.
 *
 * Cookieless: Umami по умолчанию не ставит куки и не хранит ПДн посетителя →
 * баннер согласия обычно не нужен (152-ФЗ проще). `defer` — не блокирует рендер.
 */
export function UmamiTracker({ websiteId }: { websiteId?: string | null }) {
  const id = (websiteId ?? '').trim()
  if (!UMAMI_SCRIPT_URL || !id) return null
  return <script defer src={UMAMI_SCRIPT_URL} data-website-id={id} />
}
