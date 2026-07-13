import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/**
 * Subscribers — зрители сайта (auth-коллекция), ОТДЕЛЬНО от CMS-users.
 *
 * Это конечные пользователи, которые регистрируются на сайте и (возможно)
 * оформляют подписку. Включает и бесплатных (activeTier пуст). НЕ имеют
 * доступа в админку Payload — вход только через фронтовый логин в шапке сайта.
 *
 * Доступ в CMS: staff (superadmin / editor) видят подписчиков своего тенанта
 * для управления. Сами подписчики в /admin не заходят (admin: false).
 *
 * Группа админки: «Управление».
 */

const subscribersScoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user as any)) return true
  const tenantID = getUserTenantID(user as any)
  if (!tenantID) return false
  return { tenant: { equals: tenantID } }
}

export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  auth: true,
  labels: { singular: 'Подписчик', plural: 'Пользователи' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'displayName', 'activeTier', 'subscriptionUntil'],
    group: 'Управление',
    description: 'Все зарегистрированные зрители, включая бесплатных.',
  },
  access: {
    // Чтение/управление — только staff своего тенанта.
    read: subscribersScoped,
    create: ({ req: { user } }) =>
      isSuperAdmin(user as any) || Boolean(getUserTenantID(user as any)),
    update: subscribersScoped,
    delete: subscribersScoped,
    // КРИТИЧНО: подписчики НЕ входят в админ-панель Payload.
    // admin возвращает true только для staff (CMS-users), не для subscribers.
    admin: ({ req: { user } }) => {
      // user из коллекции subscribers не должен видеть админку вообще.
      if ((user as any)?.collection === 'subscribers') return false
      return Boolean(user)
    },
  },
  fields: [
    // `email` / `password` инжектит `auth: true`.
    { name: 'displayName', type: 'text', label: 'Отображаемое имя' },
    {
      name: 'activeTier',
      type: 'relationship',
      relationTo: 'subscription-tiers',
      label: 'Активный уровень',
      admin: {
        description: 'Пусто = бесплатный аккаунт без подписки.',
        readOnly: true,
      },
    },
    {
      name: 'subscriptionUntil',
      type: 'date',
      label: 'Подписка активна до',
      admin: {
        description: 'Дата окончания текущей оплаченной подписки.',
        readOnly: true,
      },
    },
    {
      name: 'isBlocked',
      type: 'checkbox',
      defaultValue: false,
      label: 'Заблокирован',
    },
    // `tenant` инжектит multi-tenant плагин.
  ],
  timestamps: true,
}
