import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { ProfileView } from './ProfileView'

/**
 * Профиль автора (студия): просмотр email/роли/тенанта, смена пароля и email,
 * выход. Данные берём из сессии + запись тенанта для отображения названия.
 */

export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<string, string> = {
  editor: 'Редактор',
  admin: 'Администратор',
  viewer: 'Наблюдатель',
}

export default async function ProfilePage() {
  const author = await getCurrentAuthor()
  const payload = await getPayload({ config: await config })

  let tenantName = ''
  try {
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: author!.tenantId,
      depth: 0,
      overrideAccess: true,
    })
    tenantName = (tenant as any)?.name || ''
  } catch {
    /* noop */
  }

  const role = (author!.user as any).tenantRole || 'editor'

  return (
    <ProfileView
      email={author!.user.email}
      roleLabel={ROLE_LABELS[role] || role}
      tenantName={tenantName}
    />
  )
}
