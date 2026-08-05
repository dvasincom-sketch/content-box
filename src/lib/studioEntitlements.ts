import type { Payload } from 'payload'

/** Возможности студии, гейтингуемые тарифом/правами тенанта. */
export type Capability = 'publications' | 'books' | 'media' | 'customDomain'

export type Entitlements = {
  capBooks: 'none' | 'trial' | 'active'
  capBooksUntil: string | null
  capMedia: 'none' | 'trial' | 'active'
  capMediaUntil: string | null
  capCustomDomain: boolean
  studioFrozen: boolean
}

function stateActive(state: string | null | undefined, until: string | null): boolean {
  if (state === 'active') return true
  if (state === 'trial') return !until || new Date(until).getTime() > Date.now()
  return false
}

/** Доступна ли возможность. Заморозка перекрывает всё (кроме чтения — гейтим
 *  только запись/разделы). Публикации бесплатны и всегда доступны (если не
 *  заморожено). Дефолты миграции — открытые, поэтому существующие тенанты «Открыто». */
export function canUse(ent: Entitlements | null | undefined, cap: Capability): boolean {
  if (!ent) return true // нет данных — не ломаем (fail-open, как и дефолты)
  if (ent.studioFrozen) return false
  switch (cap) {
    case 'publications': return true
    case 'books': return stateActive(ent.capBooks, ent.capBooksUntil)
    case 'media': return stateActive(ent.capMedia, ent.capMediaUntil)
    case 'customDomain': return ent.capCustomDomain === true
  }
}

/** Читает права тенанта. Fail-open: при ошибке возвращает null → canUse=true. */
export async function loadEntitlements(payload: Payload, tenantId: number | string): Promise<Entitlements | null> {
  try {
    const t = (await payload.findByID({ collection: 'tenants', id: tenantId, depth: 0, overrideAccess: true })) as any
    if (!t) return null
    return {
      capBooks: t.capBooks || 'active',
      capBooksUntil: t.capBooksUntil || null,
      capMedia: t.capMedia || 'active',
      capMediaUntil: t.capMediaUntil || null,
      capCustomDomain: t.capCustomDomain !== false,
      studioFrozen: t.studioFrozen === true,
    }
  } catch {
    return null
  }
}

/** Копирайт для экрана «оформить пакет». */
export const CAP_UPSELL: Record<Capability, { title: string; text: string }> = {
  publications: { title: 'Публикации', text: 'Публикации доступны бесплатно.' },
  books: { title: 'Книги', text: 'Раздел «Книги» доступен по пакету. Оформите доступ, чтобы публиковать произведения и главы.' },
  media: { title: 'Медиа', text: 'Загрузка видео, аудио, файлов и галерей — расширенная возможность студии. Оформите пакет или запросите тест-доступ.' },
  customDomain: { title: 'Свой домен', text: 'Подключение собственного домена — платная услуга.' },
}
