import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

/**
 * Посев персон для визуального QA:
 *  - подписчик (collection subscribers) — фронт-аккаунт, привязан к активному тенанту;
 *  - автор студии (collection users) — tenant + tenantRole:'editor' (getCurrentAuthor
 *    пускает в /studio только tenant-scoped users, не суперадмина).
 * Плюс включаем tenant.onboardingComplete, иначе layout студии редиректит на онбординг.
 *
 * Активный тенант создаёт globalSetup (tests/e2e/global-setup.ts).
 */
export const subscriberUser = { email: 'e2e-subscriber@example.com', password: 'test1234' }
export const studioAuthor = { email: 'e2e-author@example.com', password: 'test1234' }

async function getActiveTenantId(): Promise<number> {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'tenants',
    where: { status: { equals: 'active' } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const tenant = res.docs[0]
  if (!tenant) throw new Error('Нет активного тенанта — globalSetup должен был его создать')
  // Онбординг завершён, иначе студия уводит на /studio/onboarding.
  await payload.update({
    collection: 'tenants',
    id: tenant.id,
    data: { onboardingComplete: true } as Record<string, unknown>,
    overrideAccess: true,
  })
  return tenant.id as number
}

export async function seedPersonas(): Promise<void> {
  const payload = await getPayload({ config })
  const tenant = await getActiveTenantId()

  await payload.delete({ collection: 'subscribers', where: { email: { equals: subscriberUser.email } }, overrideAccess: true })
  await payload.create({
    collection: 'subscribers',
    data: { ...subscriberUser, tenant } as Record<string, unknown>,
    overrideAccess: true,
  })

  await payload.delete({ collection: 'users', where: { email: { equals: studioAuthor.email } }, overrideAccess: true })
  await payload.create({
    collection: 'users',
    data: { ...studioAuthor, tenant, tenantRole: 'editor' } as Record<string, unknown>,
    overrideAccess: true,
  })
}

export async function cleanupPersonas(): Promise<void> {
  const payload = await getPayload({ config })
  await payload.delete({ collection: 'subscribers', where: { email: { equals: subscriberUser.email } }, overrideAccess: true })
  await payload.delete({ collection: 'users', where: { email: { equals: studioAuthor.email } }, overrideAccess: true })
}
