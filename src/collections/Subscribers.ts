import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'
import { subscriberResetSubject, subscriberResetHTML } from '../emails/authEmails'

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
  auth: {
    // Брендированное письмо сброса пароля в бренде тенанта, ссылка на его сайт.
    forgotPassword: {
      generateEmailSubject: (args) => subscriberResetSubject(args),
      generateEmailHTML: (args) => subscriberResetHTML(args),
    },
  },
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
    // ── Профиль участника (Фаза 1 «Сообщество») ──────────────────────────
    // Публичная страница /u/<handle>. Профиль по умолчанию публичный и
    // индексируемый (SEO-приоритет); participant может скрыть (profilePrivate).
    { name: 'avatar', type: 'upload', relationTo: 'media', label: 'Аватар' },
    {
      name: 'bio',
      type: 'textarea',
      label: 'О себе',
      maxLength: 280,
      admin: { description: 'Короткое описание в профиле. Без ссылок.' },
    },
    {
      name: 'handle',
      type: 'text',
      label: 'Адрес профиля (/u/…)',
      admin: {
        description: '3–30 символов: латиница, цифры, дефис. Уникален в рамках сайта.',
      },
    },
    {
      name: 'profilePrivate',
      type: 'checkbox',
      defaultValue: false,
      label: 'Скрыть профиль',
      admin: { description: 'Публичный по умолчанию. Если включено — профиль не виден и не индексируется.' },
    },
    // Репутация (заглушки Фазы 1; наполняются в Фазе 2). Только сервер.
    {
      name: 'points',
      type: 'number',
      defaultValue: 0,
      label: 'Очки активности',
      access: { create: () => false, update: () => false },
      admin: { readOnly: true },
    },
    {
      name: 'level',
      type: 'number',
      defaultValue: 0,
      label: 'Уровень',
      access: { create: () => false, update: () => false },
      admin: { readOnly: true },
    },
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
    // ── Подтверждение email (мягкое) ──────────────────────────────────────
    // «Мягкое»: НЕ блокирует вход. Регистрация и логин работают как раньше,
    // а флаг emailVerified лишь фиксирует, подтвердил ли адрес владелец.
    // Токен/срок заполняются сервером (overrideAccess) — извне не выставить.
    {
      name: 'emailVerified',
      type: 'checkbox',
      defaultValue: false,
      label: 'Email подтверждён',
      access: { create: () => false, update: () => false },
      admin: { readOnly: true },
    },
    {
      name: 'emailVerifyToken',
      type: 'text',
      label: 'Токен подтверждения email',
      access: { create: () => false, read: () => false, update: () => false },
      admin: { hidden: true },
    },
    {
      name: 'emailVerifyExpiry',
      type: 'date',
      label: 'Срок действия токена',
      access: { create: () => false, read: () => false, update: () => false },
      admin: { hidden: true },
    },
    // ── Дайджест-уведомления ──────────────────────────────────────────────
    // notifyDigest — согласие получать дайджест новых материалов (по умолч.
    // включено). unsubscribeToken — стабильный токен для ссылки «отписаться»
    // в письме; заполняется сервером при первой рассылке.
    {
      name: 'notifyDigest',
      type: 'checkbox',
      defaultValue: true,
      label: 'Присылать дайджест',
      access: { create: () => false },
    },
    {
      name: 'unsubscribeToken',
      type: 'text',
      label: 'Токен отписки',
      access: { create: () => false, read: () => false, update: () => false },
      admin: { hidden: true },
    },
    // `tenant` инжектит multi-tenant плагин.
  ],
  timestamps: true,
}
