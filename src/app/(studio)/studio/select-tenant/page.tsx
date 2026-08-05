import { redirect } from 'next/navigation'
import { cookies } from 'next/headers.js'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { authenticatedUser } from '@/lib/currentUser'
import { ACTING_TENANT_COOKIE } from '@/lib/currentAuthor'
import type { User } from '@/payload-types'
import { SelectTenantList } from './SelectTenantList'

// Приватный экран под auth+БД — рендерим на каждый запрос (как остальная студия).
export const dynamic = 'force-dynamic'

/**
 * Пикер тенанта для платформенного администратора (superadmin). Живёт ВНЕ групп
 * (app)/(auth), поэтому не завязан на их guard'ы: (app) требует автора (у
 * superadmin без выбора его нет), (auth) уводит авторизованного на /studio — и
 * то и другое ломало бы возможность выбрать/сменить проект. Проверку делаем тут.
 */
export default async function SelectTenantPage() {
  const u = await authenticatedUser()
  if (!u || u.collection !== 'users') redirect('/studio/login')
  if ((u as User).platformRole !== 'superadmin') redirect('/studio')

  const payload = await getPayload({ config: await config })
  const res = await payload.find({
    collection: 'tenants',
    sort: 'name',
    depth: 0,
    limit: 500,
    overrideAccess: true,
  })
  const tenants = res.docs.map((t) => ({
    id: t.id as number,
    name: (t as { name?: string }).name || `#${t.id}`,
    subdomain: (t as { subdomain?: string }).subdomain || '',
  }))

  const store = await cookies()
  const raw = store.get(ACTING_TENANT_COOKIE)?.value
  const currentId = raw && Number.isFinite(Number(raw)) ? Number(raw) : null

  return <SelectTenantList tenants={tenants} currentId={currentId} email={(u as User).email} />
}
