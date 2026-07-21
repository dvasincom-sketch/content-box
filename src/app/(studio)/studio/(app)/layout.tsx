import React from 'react'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { StudioNav } from './StudioNav'
import { SessionGuard } from './SessionGuard'

/**
 * Layout приватной части студии. Guard: нет автора → на /studio/login.
 * Подписчик (collection subscribers) сюда не пройдёт — getCurrentAuthor
 * возвращает null для всех, кроме users с tenant.
 */
export default async function StudioAppLayout({ children }: { children: React.ReactNode }) {
  const author = await getCurrentAuthor()
  if (!author) {
    redirect('/studio/login')
  }

  // Имя тенанта для брендинга сайдбара.
  let brandName = 'Студия'
  try {
    const payload = await getPayload({ config: await config })
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: author.tenantId,
      depth: 0,
      overrideAccess: true,
    })
    brandName = (tenant as any)?.name || brandName
  } catch {
    /* дефолт при ошибке */
  }

  return (
    <div className="studio-shell">
      <StudioNav authorEmail={author.user.email} brandName={brandName} />
      <main className="studio-main">{children}</main>
      {/* Клиентский сторож сессии: показывает экран «Сессия истекла» при
          протухании токена в фоне (напр. после сна устройства). */}
      <SessionGuard />
    </div>
  )
}
