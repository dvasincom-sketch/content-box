import React from 'react'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { authenticatedUser } from '@/lib/currentUser'
import type { User } from '@/payload-types'
import { StudioNav } from './StudioNav'
import { SessionGuard } from './SessionGuard'
import { BugReportWidget } from '@/components/BugReportWidget'
import { canUse, type Entitlements } from '@/lib/studioEntitlements'

/**
 * Layout приватной части студии. Guard: нет автора → на /studio/login.
 * Подписчик (collection subscribers) сюда не пройдёт — getCurrentAuthor
 * возвращает null для всех, кроме users с tenant.
 *
 * Особый случай — superadmin: он «автор» только выбрав активный тенант
 * (переключатель /studio/select-tenant). Залогинен, но тенант не выбран →
 * getCurrentAuthor === null; тогда уводим его на пикер, а не на форму входа.
 */
export default async function StudioAppLayout({ children }: { children: React.ReactNode }) {
  const author = await getCurrentAuthor()
  if (!author) {
    // Различаем «не залогинен» и «superadmin без выбранного проекта».
    const u = await authenticatedUser()
    if (u && u.collection === 'users' && (u as User).platformRole === 'superadmin') {
      redirect('/studio/select-tenant')
    }
    redirect('/studio/login')
  }

  // Тенант: имя для брендинга сайдбара + гейт онбординга.
  let brandName = 'Студия'
  let onboardingComplete = true
  let ent: Entitlements | null = null
  try {
    const payload = await getPayload({ config: await config })
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: author.tenantId,
      depth: 0,
      overrideAccess: true,
    }) as any
    brandName = tenant.name || brandName
    onboardingComplete = Boolean(tenant.onboardingComplete)
    ent = {
      capBooks: tenant.capBooks || 'active',
      capBooksUntil: tenant.capBooksUntil || null,
      capMedia: tenant.capMedia || 'active',
      capMediaUntil: tenant.capMediaUntil || null,
      capCustomDomain: tenant.capCustomDomain !== false,
      studioFrozen: tenant.studioFrozen === true,
    }
  } catch {
    /* дефолт при ошибке */
  }
  const nav = { books: canUse(ent, 'books'), media: canUse(ent, 'media'), frozen: !!ent?.studioFrozen }
  const isOwner = (author.user as { tenantRole?: string | null }).tenantRole !== 'contributor'

  // Незавершённый онбординг → в мастер (вне try, чтобы redirect не проглотился).
  // Для superadmin онбординг тенанта пропускаем: он не владелец, а обслуживает
  // чужой проект через переключатель — мастер настройки ему не нужен.
  if (!onboardingComplete && !author.isSuperadmin) {
    redirect('/studio/onboarding')
  }

  return (
    <div className="studio-shell">
      <StudioNav
        authorEmail={author.user.email}
        brandName={brandName}
        nav={nav}
        isOwner={isOwner}
        isSuperadmin={author.isSuperadmin}
      />
      <main className="studio-main">
        {nav.frozen && (
          <div style={{ margin: '0 0 16px', padding: '12px 16px', borderRadius: 12, background: 'color-mix(in srgb, var(--st-warning, #d97706) 18%, transparent)', color: 'var(--st-text)', fontSize: 14 }}>
            Студия заморожена. Публикация и загрузка недоступны. <a href="/studio/upgrade" style={{ textDecoration: 'underline' }}>Подробнее</a>
          </div>
        )}
        {children}
      </main>
      {/* Клиентский сторож сессии: показывает экран «Сессия истекла» при
          протухании токена в фоне (напр. после сна устройства). */}
      <SessionGuard />
      {/* Баг-баунти: автор студии всегда известен (attached как reporterUser),
          очков авторам не начисляем — подача нейтральная (rewards=false). */}
      <BugReportWidget authed source="studio" rewards={false} loginHref={null} />
    </div>
  )
}
