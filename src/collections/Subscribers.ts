import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID, superAdminFieldAccess, isSubscriber } from '../access'
import { subscriberResetSubject, subscriberResetHTML } from '../emails/authEmails'
import { subscriptionAfterChange } from '../lib/logSubscriptionEvent'
import { logSubscriberActivity } from '../lib/logSubscriberActivity'

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
  if (isSuperAdmin(user)) return true
  const tenantID = getUserTenantID(user)
  if (!tenantID) return false
  return { tenant: { equals: tenantID } }
}

/**
 * Логин строго в пределах своего тенанта.
 *
 * `subscribers.email` уникален ГЛОБАЛЬНО, а `POST /api/subscribers/login` —
 * встроенный роут Payload на байпас-пути, без привязки к домену. Поэтому
 * подписчик тенанта B успешно логинился на сайте тенанта A и получал валидную
 * куку. Раньше это давало кросс-тенантный доступ; после привязки подписчика к
 * тенанту в getCurrentSubscriber кука стала просто игнорироваться — вход
 * «проходил», но пользователь оставался гостем и бесконечно возвращался на
 * форму логина без единого сообщения. Отклоняем такой вход явно.
 *
 * Если тенанта по хосту определить не удалось, вход НЕ блокируем: сайт в таком
 * состоянии всё равно не обслуживается (proxy отдаёт /domain-not-found), а
 * доступ к данным по-прежнему закрыт проверкой в getCurrentSubscriber. Так
 * ошибка резолвинга не превращается в полную недоступность логина.
 */
const beforeLoginTenantGuard: NonNullable<CollectionConfig['hooks']>['beforeLogin'] = [
  async ({ req, user }) => {
    const host = req.headers?.get('x-forwarded-host') ?? req.headers?.get('host') ?? ''
    if (!host) return user

    const { tenantIdByHost } = await import('../lib/tenantByHost')
    const currentTenant = await tenantIdByHost(host).catch(() => null)
    if (!currentTenant) return user

    const own = (user as any)?.tenant
    const ownId = own == null ? null : String(typeof own === 'object' ? own.id : own)
    if (ownId && ownId !== currentTenant) {
      throw new Error('Аккаунт с таким email зарегистрирован на другом сайте.')
    }
    return user
  },
]

/**
 * afterLogin — фиксируем момент входа зрителя (lastSeenAt) для дашборда.
 *
 * ВАЖНО: fire-and-forget. Логин не должен ждать запись в БД (иначе при
 * нагрузке пул соединений голодает и форма входа «висит» — та же причина, что
 * чинили для CMS-users). Ошибки глотаем: аналитика входа вторична. context-флаг
 * гасит лишний afterChange-проход subscriptionAfterChange (тариф не меняется —
 * события всё равно не будет, но и лишнюю работу не делаем).
 */
const touchLastSeen: NonNullable<CollectionConfig['hooks']>['afterLogin'] = [
  ({ req, user }) => {
    const payload = req?.payload
    const id = (user as { id?: number | string })?.id
    if (payload && id != null) {
      void payload
        .update({
          collection: 'subscribers',
          id,
          data: { lastSeenAt: new Date().toISOString() },
          overrideAccess: true,
          context: { skipSubscriptionEvent: true },
        })
        .catch(() => {})
      void logSubscriberActivity(payload, {
        tenant: (user as { tenant?: unknown })?.tenant,
        subscriber: id,
        action: 'login',
      })
    }
    return user
  },
]

/** afterChange: одноразовое событие «регистрация» при создании зрителя. */
const logSubscriberRegister: NonNullable<NonNullable<CollectionConfig['hooks']>['afterChange']>[number] = ({
  doc,
  req,
  operation,
}) => {
  if (operation !== 'create') return
  const payload = req?.payload
  if (payload && doc?.id != null) {
    void logSubscriberActivity(payload, {
      tenant: (doc as { tenant?: unknown })?.tenant,
      subscriber: doc.id,
      action: 'register',
    })
  }
}

export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  auth: {
    // Stateless JWT: сессии Payload 3.85 (subscribers_sessions) не валидируются
    // за TLS-терминирующим реверс-прокси Timeweb — свежий логин отдаёт токен, но
    // куку тут же «разлогинивает». Без sid проверка идёт по подписи, старые куки
    // остаются валидны.
    useSessions: false,
    // Брендированное письмо сброса пароля в бренде тенанта, ссылка на его сайт.
    forgotPassword: {
      generateEmailSubject: (args) => subscriberResetSubject(args),
      generateEmailHTML: (args) => subscriberResetHTML(args),
    },
  },
  hooks: { beforeLogin: beforeLoginTenantGuard, afterLogin: touchLastSeen, afterChange: [subscriptionAfterChange, logSubscriberRegister] },
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
      isSuperAdmin(user) || Boolean(getUserTenantID(user)),
    update: subscribersScoped,
    delete: subscribersScoped,
    // КРИТИЧНО: подписчики НЕ входят в админ-панель Payload.
    // admin возвращает true только для staff (CMS-users), не для subscribers.
    admin: ({ req: { user } }) => {
      // user из коллекции subscribers не должен видеть админку вообще.
      if (isSubscriber(user)) return false
      return Boolean(user)
    },
  },
  fields: [
    // `email` / `password` инжектит `auth: true`.
    { name: 'displayName', type: 'text', label: 'Отображаемое имя' },
    // ── Вход по телефону (SMS-код) ───────────────────────────────────────
    { name: 'phone', type: 'text', label: 'Телефон', index: true, admin: { description: 'Канонический вид 7XXXXXXXXXX. Заполняется при входе по SMS.' } },
    { name: 'phoneVerified', type: 'checkbox', label: 'Телефон подтверждён', defaultValue: false, admin: { readOnly: true } },
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
    // Уровень подписки и её срок — это и есть платный доступ. `readOnly` в
    // admin прячет поля только из UI: без field-access их можно было выставить
    // себе через REST (`PATCH /api/subscribers/<id>`) и получить платный
    // контент бесплатно — редактору тенанта или самому подписчику.
    //
    // Оставляем запись суперадмину (пока оплата не подключена, выдача подписки
    // ручная) и серверу через overrideAccess — там позже сядет вебхук шлюза.
    // Payload при отказе field-access не бросает ошибку, а молча выбрасывает
    // поле из payload'а, поэтому запрет должен быть точным, а не сплошным.
    {
      name: 'activeTier',
      type: 'relationship',
      relationTo: 'subscription-tiers',
      label: 'Активный уровень',
      access: { create: superAdminFieldAccess, update: superAdminFieldAccess },
      admin: {
        description: 'Пусто = бесплатный аккаунт без подписки. Меняет только суперадмин.',
      },
    },
    {
      name: 'subscriptionUntil',
      type: 'date',
      label: 'Подписка активна до',
      access: { create: superAdminFieldAccess, update: superAdminFieldAccess },
      admin: {
        description: 'Дата окончания текущей оплаченной подписки. Меняет только суперадмин.',
      },
    },
    {
      name: 'pendingTier',
      type: 'relationship',
      relationTo: 'subscription-tiers',
      label: 'Запланированный уровень (со след. периода)',
      access: { create: superAdminFieldAccess, update: superAdminFieldAccess },
      admin: {
        description: 'Понижение уровня, запланированное на следующее продление. Применяется автосписанием, затем очищается. Пусто = смены не запланировано.',
      },
    },
    // ── Рекуррентные платежи ЮKassa (пишет только сервер: вебхук/крон) ────────
    {
      name: 'autoRenew',
      type: 'checkbox',
      defaultValue: false,
      label: 'Автопродление',
      access: { create: superAdminFieldAccess, update: superAdminFieldAccess },
      admin: { description: 'Включается при оплате с сохранением карты; выключается при отмене подписки.' },
    },
    {
      name: 'yookassaPaymentMethodId',
      type: 'text',
      label: 'ЮKassa: сохранённый способ оплаты',
      access: { create: superAdminFieldAccess, update: superAdminFieldAccess },
      admin: { readOnly: true, description: 'payment_method_id для автосписаний. Пишет сервер.' },
    },
    {
      name: 'cardLabel',
      type: 'text',
      label: 'Карта',
      access: { create: superAdminFieldAccess, update: superAdminFieldAccess },
      admin: { readOnly: true, description: 'Маска карты, напр. VISA ****4567.' },
    },
    {
      name: 'subscriptionSince',
      type: 'date',
      label: 'Подписка оформлена',
      access: { create: superAdminFieldAccess, update: superAdminFieldAccess },
      admin: { readOnly: true },
    },
    {
      name: 'lastPaymentAt',
      type: 'date',
      label: 'Последний платёж',
      access: { create: superAdminFieldAccess, update: superAdminFieldAccess },
      admin: { readOnly: true },
    },
    {
      name: 'isBlocked',
      type: 'checkbox',
      defaultValue: false,
      label: 'Заблокирован',
    },
    {
      name: 'lastSeenAt',
      type: 'date',
      label: 'Последний вход',
      access: { create: () => false, update: () => false },
      admin: { readOnly: true, description: 'Момент последнего входа. Ставит сервер (afterLogin).' },
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
      name: 'historyEnabled',
      type: 'checkbox',
      defaultValue: true,
      label: 'Вести историю просмотров',
      access: { create: () => false },
    },
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
