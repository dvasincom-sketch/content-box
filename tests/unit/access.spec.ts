import { describe, it, expect } from 'vitest'
import {
  isStaff,
  isSuperAdmin,
  getUserTenantID,
  tenantScoped,
  tenantScopedCollection,
  tenantsPublicRead,
} from '@/access'

/**
 * Тесты на слой контроля доступа.
 *
 * Именно здесь жили две дыры, которые молча пережили бы любой рефакторинг:
 *  1) access-функции не различали auth-коллекцию, поэтому залогиненный ЗРИТЕЛЬ
 *     (subscribers) проходил tenant-scoped правила как персонал тенанта;
 *  2) контентные коллекции имели `read: () => true`, то есть публичный REST
 *     отдавал материалы всех тенантов, включая платные и черновики.
 *
 * Регрессия тут не видна глазом — поэтому проверяем явно.
 */

// Access-функции Payload принимают { req: { user } }; остальное им не нужно.
const ctx = (user: unknown) => ({ req: { user } }) as any

const staff = { id: 1, collection: 'users', tenant: 10 }
const staffPopulated = { id: 1, collection: 'users', tenant: { id: 10 } }
const superadmin = { id: 2, collection: 'users', platformRole: 'superadmin', tenant: null }
// Плагин мультитенантности инжектит `tenant` и в subscribers — вот источник дыры.
const subscriber = { id: 3, collection: 'subscribers', tenant: 10 }

describe('isStaff / isSuperAdmin', () => {
  it('персоналом считается только пользователь из коллекции users', () => {
    expect(isStaff(staff)).toBe(true)
    expect(isStaff(subscriber)).toBe(false)
    expect(isStaff(null)).toBe(false)
    expect(isStaff(undefined)).toBe(false)
  })

  it('подписчик не может стать суперадмином, даже если у него есть platformRole', () => {
    expect(isSuperAdmin(superadmin)).toBe(true)
    expect(isSuperAdmin(staff)).toBe(false)
    expect(
      isSuperAdmin({ id: 9, collection: 'subscribers', platformRole: 'superadmin' } as any),
    ).toBe(false)
  })
})

describe('getUserTenantID', () => {
  it('отдаёт тенант персонала — и по id, и по populated-объекту', () => {
    expect(getUserTenantID(staff)).toBe(10)
    expect(getUserTenantID(staffPopulated)).toBe(10)
  })

  it('для подписчика тенант НЕ отдаётся, хотя поле у него заполнено', () => {
    expect(getUserTenantID(subscriber)).toBeUndefined()
  })

  it('аноним — undefined', () => {
    expect(getUserTenantID(null)).toBeUndefined()
    expect(getUserTenantID(undefined)).toBeUndefined()
  })
})

describe('tenantScoped', () => {
  it('суперадмин видит всё', () => {
    expect(tenantScoped(ctx(superadmin))).toBe(true)
  })

  it('персонал сужается Where-запросом до своего тенанта', () => {
    expect(tenantScoped(ctx(staff))).toEqual({ tenant: { equals: 10 } })
  })

  it('подписчик и аноним — отказ (а не Where и не true)', () => {
    expect(tenantScoped(ctx(subscriber))).toBe(false)
    expect(tenantScoped(ctx(null))).toBe(false)
  })
})

describe('tenantScopedCollection — контентные коллекции', () => {
  it('анонимное чтение через REST закрыто', () => {
    expect(tenantScopedCollection.read(ctx(null))).toBe(false)
  })

  it('подписчик не читает и не пишет контент тенанта через REST', () => {
    expect(tenantScopedCollection.read(ctx(subscriber))).toBe(false)
    expect(tenantScopedCollection.update(ctx(subscriber))).toBe(false)
    expect(tenantScopedCollection.delete(ctx(subscriber))).toBe(false)
  })

  it('все четыре операции скоуплены одинаково', () => {
    const expected = { tenant: { equals: 10 } }
    expect(tenantScopedCollection.read(ctx(staff))).toEqual(expected)
    expect(tenantScopedCollection.create(ctx(staff))).toEqual(expected)
    expect(tenantScopedCollection.update(ctx(staff))).toEqual(expected)
    expect(tenantScopedCollection.delete(ctx(staff))).toEqual(expected)
  })
})

describe('tenantsPublicRead', () => {
  it('аноним видит только активных и подтверждённых (резолвинг домена в proxy)', () => {
    expect(tenantsPublicRead(ctx(null))).toEqual({
      and: [{ status: { equals: 'active' } }, { domainVerified: { equals: true } }],
    })
  })

  it('суперадмин видит всех', () => {
    expect(tenantsPublicRead(ctx(superadmin))).toBe(true)
  })
})
