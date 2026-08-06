import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { requireAuthor } from '@/lib/currentAuthor'
import { loadEntitlements, canUse } from '@/lib/studioEntitlements'
import { Check, Lock } from 'lucide-react'

/** Экран «Пакеты студии»: что открыто, что по пакету. Оплата — вне продукта
 *  (подключается биллингом); здесь только статус и описание. */
export const dynamic = 'force-dynamic'

export default async function UpgradePage() {
  const author = await requireAuthor()
  const payload = await getPayload({ config: await config })
  const ent = await loadEntitlements(payload, author!.tenantId)

  const rows = [
    { title: 'Публикации', desc: 'Категории, меню, текстовые публикации.', on: true, note: 'Бесплатно' },
    { title: 'Книги', desc: 'Произведения, главы, ридер, подписка читателей.', on: canUse(ent, 'books'), note: ent?.capBooks === 'trial' ? `Триал${ent.capBooksUntil ? ' до ' + new Date(ent.capBooksUntil).toLocaleDateString('ru-RU') : ''}` : (canUse(ent, 'books') ? 'Открыто' : 'По пакету') },
    { title: 'Медиа', desc: 'Загрузка видео, аудио, файлов и галерей.', on: canUse(ent, 'media'), note: ent?.capMedia === 'trial' ? `Триал${ent.capMediaUntil ? ' до ' + new Date(ent.capMediaUntil).toLocaleDateString('ru-RU') : ''}` : (canUse(ent, 'media') ? 'Открыто' : 'По пакету / 3 дня по заявке') },
    { title: 'Свой домен', desc: 'Подключение собственного домена.', on: canUse(ent, 'customDomain'), note: canUse(ent, 'customDomain') ? 'Открыто' : 'Платно' },
  ]

  return (
    <div className="studio-page">
      <div className="studio-page-head"><h1>Пакеты студии</h1></div>
      {ent?.studioFrozen && (
        <div className="studio-card" style={{ padding: 16, marginBottom: 16, background: 'color-mix(in srgb, var(--st-warning, #d97706) 18%, transparent)' }}>
          Студия заморожена. Чтобы снять заморозку, включите платные подписки и оформите пакет.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
        {rows.map((r) => (
          <div key={r.title} className="studio-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 'none', width: 36, height: 36, borderRadius: 999, display: 'grid', placeItems: 'center', background: r.on ? 'color-mix(in srgb, var(--st-success, #16a34a) 18%, transparent)' : 'var(--st-surface-hover)' }}>
              {r.on ? <Check size={18} style={{ color: 'var(--st-success, #16a34a)' }} /> : <Lock size={16} style={{ color: 'var(--st-text-muted)' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{r.title}</div>
              <div style={{ fontSize: 13, color: 'var(--st-text-muted)' }}>{r.desc}</div>
            </div>
            <div style={{ fontSize: 13, color: r.on ? 'var(--st-text)' : 'var(--st-text-muted)' }}>{r.note}</div>
          </div>
        ))}
      </div>
      <p style={{ color: 'var(--st-text-muted)', fontSize: 13, marginTop: 20, maxWidth: 720 }}>
        Content Box — платформа платных подписок для авторов со своим сообществом. Публикации доступны сразу
        и бесплатно; при этом в течение 180 дней нужно включить платные подписки, иначе студия замораживается.
        Книги — по умолчанию 30-дневный триал. Медиа — по пакету или 3 дня по заявке. Свой домен — платная услуга.
        Оформление пакета — через поддержку.
      </p>
    </div>
  )
}
