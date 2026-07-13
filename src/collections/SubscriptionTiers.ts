import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/**
 * SubscriptionTiers — уровни подписки (РАМЁН / СОДЖУ / САМГЁПСАЛЬ).
 *
 * Иерархия через `weight`: чем выше weight, тем больше доступа. Видео с
 * minTier weight=1 доступно всем подписчикам с активным уровнем weight >= 1.
 * Так высший уровень автоматически открывает контент низших.
 *
 * Цены в рублях (ТЗ: платежи в RUB). tenant-scoped.
 * Группа админки: «Управление».
 */

const tiersScoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user as any)) return true
  const tenantID = getUserTenantID(user as any)
  if (!tenantID) return false
  return { tenant: { equals: tenantID } }
}

export const SubscriptionTiers: CollectionConfig = {
  slug: 'subscription-tiers',
  labels: { singular: 'Уровень подписки', plural: 'Подписки' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'weight', 'priceRub', 'tenant'],
    group: 'Управление',
    description: 'Уровни подписки и их настройки.',
  },
  access: {
    read: tiersScoped,
    create: ({ req: { user } }) =>
      isSuperAdmin(user as any) || Boolean(getUserTenantID(user as any)),
    update: tiersScoped,
    delete: tiersScoped,
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Название' },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      label: 'Slug',
      admin: { description: 'Латиницей: ramyeon, soju, samgyeopsal.' },
    },
    {
      name: 'weight',
      type: 'number',
      required: true,
      defaultValue: 1,
      label: 'Вес (иерархия доступа)',
      admin: {
        description:
          'Чем больше, тем выше уровень. Высший уровень открывает контент низших.',
      },
    },
    {
      name: 'priceRub',
      type: 'number',
      required: true,
      label: 'Цена, ₽/мес',
      min: 0,
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Что входит',
      admin: { description: 'Краткое описание преимуществ уровня.' },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      label: 'Активен',
      admin: { description: 'Неактивные уровни не показываются для оформления.' },
    },
    // `tenant` инжектит multi-tenant плагин (см. payload.config.ts).
  ],
  timestamps: true,
}
