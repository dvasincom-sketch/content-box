/**
 * Клиент SEO-изображений «Ася» (эндпоинт /api/alt, capability "compose"): по
 * контексту страницы придумывает alt-подпись и slug для каждого фото. Ключ —
 * секрет, дёргаем ТОЛЬКО сервер-к-серверу. Использует тот же ключ, что конструктор
 * (site-settings.aiComposeKey → env ASYA_COMPOSE_KEY).
 *
 * Env читаем ЛЕНИВО внутри функций (рантайм контейнера, не сборка).
 */
import { slugify } from '@/lib/slugify'

function altUrl(): string {
  if (process.env.ASYA_ALT_URL) return process.env.ASYA_ALT_URL
  const base = (process.env.ASYA_SUMMARY_URL || 'https://xn--80a8a2b.online/api/summary').replace(/\/summary\/?$/, '')
  return `${base}/alt`
}

export type SeoContext = { title?: string; subtitle?: string; tags?: string[]; section?: string; lang?: string }
export type SeoImageIn = { id: string; filename?: string; caption?: string; alt?: string }
export type SeoItem = { id: string; alt: string; slug: string }

/**
 * Привести slug от модели к корректному виду (латиница, дефисы) и подстраховаться
 * транслитерацией, если модель вернула кириллицу/мусор. Пустой → fallback.
 */
export function normalizeSlug(raw: string, fallback = 'photo'): string {
  const s = slugify(String(raw || ''))
  return (s || slugify(fallback) || 'photo').slice(0, 80)
}

export async function generateImageSeo(key: string, args: { context: SeoContext; images: SeoImageIn[] }): Promise<{ items: SeoItem[] }> {
  const k = (key || '').trim()
  if (!k) throw new Error('AI-ключ не задан')
  const images = (args.images || []).filter((i) => i && i.id).slice(0, 40)
  if (!images.length) return { items: [] }
  const res = await fetch(altUrl(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: args.context || {}, images }),
  })
  const j: unknown = await res.json().catch(() => null)
  const ok = res.ok && j && typeof j === 'object' && (j as { ok?: unknown }).ok === true
  if (!ok) {
    const err = (j && typeof j === 'object' && (j as { error?: unknown }).error) || `HTTP ${res.status}`
    throw new Error(String(err))
  }
  const rawItems = Array.isArray((j as { items?: unknown }).items) ? (j as { items: unknown[] }).items : []
  const items: SeoItem[] = []
  for (const it of rawItems) {
    if (!it || typeof it !== 'object') continue
    const o = it as { id?: unknown; alt?: unknown; slug?: unknown }
    const id = String(o.id ?? '').trim()
    if (!id) continue
    items.push({ id, alt: String(o.alt ?? '').trim().slice(0, 160), slug: normalizeSlug(String(o.slug ?? '')) })
  }
  return { items }
}
