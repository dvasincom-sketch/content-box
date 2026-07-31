import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

/**
 * Playwright global setup: гарантирует активный тенант.
 *
 * На localhost proxy.ts берёт ПЕРВЫЙ активный тенант (resolveDevTenant). На
 * чистой базе CI тенантов нет — тогда главная уходит в /domain-not-found и
 * фронтовый e2e падает. Здесь создаём активный тенант, если ни одного нет.
 *
 * Суперадмина для admin-тестов сеет seedTestUser (tests/helpers/seedUser.ts)
 * в beforeAll — он должен быть свежим на каждый прогон.
 */
export default async function globalSetup(): Promise<void> {
  const payload = await getPayload({ config })

  const active = await payload.find({
    collection: 'tenants',
    where: { status: { equals: 'active' } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (active.docs.length > 0) return

  await payload.create({
    collection: 'tenants',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: {
      name: 'E2E Tenant',
      domain: 'e2e.localhost',
      subdomain: 'e2e',
      status: 'active',
      domainVerified: true,
    } as any,
    overrideAccess: true,
  })
}
