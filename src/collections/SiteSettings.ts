import type { CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID, tenantScoped } from '../access'
import { HOME_SECTION_OPTIONS } from '../lib/homeSections'
import { PRESET_SELECT_OPTIONS, DEFAULT_PRESET_ID } from '../lib/themePresets'
import { BG_DECOR_OPTIONS } from '../lib/bgDecors'

/**
 * SiteSettings (ТЗ §3.3) — one record per tenant (branding, theme, SEO
 * defaults, nav, footer, socials). Runs as isGlobal via the multi-tenant
 * plugin so exactly one document exists per tenant. `tenant` field injected
 * by the plugin. Доступ — строго в пределах своего тенанта; публичный сайт
 * читает настройки через Local API (overrideAccess), не через REST.
 */
export const SiteSettings: CollectionConfig = {
  slug: 'site-settings',
  labels: { singular: 'Настройки сайта', plural: 'Настройки сайта' },
  admin: { useAsTitle: 'id' },
  access: {
    // Раньше здесь стояло `read: () => true` и `Boolean(...)` на записи.
    // В Payload булево `true` в access означает «ВСЕ документы», а не «свои»,
    // поэтому редактор тенанта A мог через `PATCH /api/site-settings/<id тенанта B>`
    // переписать чужой брендинг, тему и SEO-дефолты. Where-запрос из tenantScoped
    // сужает выборку до своего тенанта. Публичный сайт настройки читает через
    // Local API (overrideAccess), открытый REST ему не нужен.
    read: tenantScoped,
    // На create Where неприменим — тенант проставляет плагин мультитенантности;
    // достаточно требовать, чтобы это был персонал со своим тенантом.
    create: ({ req: { user } }) =>
      isSuperAdmin(user) || Boolean(getUserTenantID(user)),
    update: tenantScoped,
    delete: tenantScoped,
  },
  fields: [
    // `tenant` added by the multi-tenant plugin.
    {
      name: 'aiComposeKey',
      type: 'text',
      label: 'Ключ Аси (AI-конструктор)',
      admin: { description: 'Секретный ключ проекта в сервисе Ася (capability compose) для «Заполнить с помощью AI». Хранится в пределах тенанта, на публичный сайт не отдаётся. Если пусто — используется платформенный ключ (env).' },
      access: {
        read: ({ req: { user } }) => isSuperAdmin(user) || Boolean(getUserTenantID(user)),
      },
    },
    {
      name: 'aiDepositRub',
      type: 'number',
      label: 'Депозит на ИИ (₽)',
      defaultValue: 0,
      admin: { description: 'Аванс тенанта на оплату токенов ИИ (пополняется через оплату / вручную суперадмином). Из него списывается стоимость. Виден только staff; изменяется только суперадмином.' },
      access: {
        read: ({ req: { user } }) => isSuperAdmin(user) || Boolean(getUserTenantID(user)),
        update: ({ req: { user } }) => isSuperAdmin(user),
      },
    },
    { name: 'logo', type: 'upload', relationTo: 'media', label: 'Логотип' },
    {
      name: 'appIcon',
      type: 'upload',
      relationTo: 'media',
      label: 'Иконка приложения (квадрат)',
      admin: { description: 'Квадратная иконка для PWA, favicon и apple-touch. Лучше 512×512+.' },
    },
    {
      name: 'themePreset',
      type: 'select',
      label: 'Тема оформления',
      defaultValue: DEFAULT_PRESET_ID,
      options: PRESET_SELECT_OPTIONS,
      admin: {
        description:
          'Готовый пресет: палитра (светлая + тёмная версии) и пара шрифтов уже подобраны под нишу. Выбирается в Студии.',
      },
    },
    {
      // Источник активной палитры: пресет/шаблон или своя тема из custom-themes.
      // Управляется студией; при выборе пресета/шаблона сбрасывается в 'preset'.
      name: 'themeSource',
      type: 'select',
      label: 'Источник палитры',
      defaultValue: 'preset',
      options: [
        { label: 'Пресет/шаблон', value: 'preset' },
        { label: 'Своя тема', value: 'custom' },
      ],
      access: { create: () => false, update: () => false },
      admin: { readOnly: true, description: 'Служебное: правится студией.' },
    },
    {
      // id активной пользовательской темы (custom-themes). Действует при
      // themeSource='custom'. Храним как число, чтобы не тащить FK-relation.
      name: 'activeCustomTheme',
      type: 'number',
      label: 'Активная своя тема (id)',
      access: { create: () => false, update: () => false },
      admin: { readOnly: true, description: 'Служебное: правится студией.' },
    },
    // ── Ключ внешнего API (миграция/автоматизация) ──────────────────────────
    // Значение ключа НЕ храним — только sha256-хеш (для резолва тенанта по
    // X-API-KEY), префикс (показать «cbx_ab12…») и даты. Всё server-only.
    {
      name: 'externalApiKeyHash',
      type: 'text',
      index: true,
      label: 'Внешний API — хеш ключа',
      access: { create: () => false, update: () => false },
      admin: { hidden: true },
    },
    {
      name: 'externalApiKeyPrefix',
      type: 'text',
      label: 'Внешний API — префикс ключа',
      access: { create: () => false, update: () => false },
      admin: { readOnly: true, description: 'Начало ключа для опознания (сам ключ не хранится).' },
    },
    {
      name: 'externalApiKeyCreatedAt',
      type: 'date',
      label: 'Внешний API — ключ создан',
      access: { create: () => false, update: () => false },
      admin: { readOnly: true },
    },
    {
      name: 'externalApiKeyLastUsedAt',
      type: 'date',
      label: 'Внешний API — последнее использование',
      access: { create: () => false, update: () => false },
      admin: { readOnly: true },
    },
    // ── Приём платежей: ЮKassa магазина автора (Вариант 1) ───────────────────
    // Правит студия (owner) через роут с overrideAccess. Секрет наружу не отдаём.
    {
      name: 'yookassaShopId',
      type: 'text',
      label: 'ЮKassa: shopId',
      access: { create: () => false, update: () => false },
      admin: { readOnly: true, description: 'Магазин ЮKassa автора. Правится в студии.' },
    },
    {
      name: 'yookassaSecret',
      type: 'text',
      label: 'ЮKassa: секретный ключ',
      access: { create: () => false, update: () => false, read: () => false },
      admin: { hidden: true },
    },
    {
      name: 'yookassaMode',
      type: 'select',
      defaultValue: 'test',
      options: [
        { label: 'Тест', value: 'test' },
        { label: 'Боевой', value: 'live' },
      ],
      label: 'ЮKassa: режим',
      access: { create: () => false, update: () => false },
      admin: { readOnly: true },
    },
    {
      name: 'yookassaTaxSystem',
      type: 'number',
      label: 'ЮKassa: СНО (код 1–6)',
      access: { create: () => false, update: () => false },
      admin: { readOnly: true, description: 'Система налогообложения для чека 54-ФЗ.' },
    },
    {
      name: 'yookassaVatCode',
      type: 'number',
      defaultValue: 1,
      label: 'ЮKassa: ставка НДС (код 1–6)',
      access: { create: () => false, update: () => false },
      admin: { readOnly: true, description: 'Код ставки НДС для чека (1 = без НДС).' },
    },
    {
      name: 'bgDecor',
      type: 'select',
      label: 'Фоновый декор',
      defaultValue: 'none',
      options: BG_DECOR_OPTIONS,
      admin: {
        description:
          'Фоновые объекты из библиотеки (пальмы, звёзды, горы и т.д.) — приглушённо, в цвете темы, за контентом. Выбирается в Студии.',
      },
    },
    {
      name: 'authorStats',
      type: 'group',
      label: 'Витрина «Об авторе» — счётчики',
      admin: { description: 'Числа в блоке «Об авторе» на главной. Значение — строка (можно «800+», «100 тыс+»). Пусто = реальные данные.' },
      fields: [
        { name: 'videosValue', type: 'text', label: 'Видео — значение (напр. 800+)' },
        { name: 'videosLabel', type: 'text', label: 'Видео — подпись', defaultValue: 'озвученных видео' },
        { name: 'membersValue', type: 'text', label: 'Участники — значение (напр. 100 тыс+)' },
        { name: 'membersLabel', type: 'text', label: 'Участники — подпись', defaultValue: 'участников' },
      ],
    },
    {
      // Сохранённые пер-тенантные шаблоны главной («Мои шаблоны»): массив
      // { id, name, themePreset, sections[{type,enabled,config}], content }.
      // Хранится одним jsonb-блобом (без под-таблицы/enum) — правится из студии.
      name: 'savedTemplates',
      type: 'json',
      admin: { hidden: true },
    },
    {
      name: 'donatePresets',
      type: 'json',
      label: 'Быстрые суммы (Поддержать разово)',
      admin: { description: 'Чипсы на странице поддержки: [{ amount, label }].' },
    },
    {
      // id последнего применённого шаблона (базового packId или id своего) —
      // для подсветки активного и подсказки «сохранить изменённый как свой».
      name: 'appliedTemplate',
      type: 'text',
      admin: { hidden: true },
    },
    {
      name: 'theme',
      type: 'group',
      label: 'Тема (токены)',
      // Устарело: цвета задаёт пресет (themePreset). Оставлено ради данных,
      // скрыто из админки — раздельный выбор цветов больше не поддерживается.
      admin: { hidden: true },
      fields: [
        { name: 'primary', type: 'text', admin: { description: 'напр. #7C3AED' } },
        { name: 'accent', type: 'text' },
        { name: 'background', type: 'text' },
        { name: 'surface', type: 'text' },
        { name: 'text', type: 'text' },
      ],
    },
    {
      name: 'typography',
      type: 'group',
      label: 'Типографика',
      // Устарело: шрифты задаёт пресет (themePreset). Скрыто из админки.
      admin: { hidden: true },
      fields: [
        {
          name: 'headingFont',
          type: 'select',
          label: 'Шрифт заголовков',
          defaultValue: 'inter',
          options: [
            { label: 'Inter', value: 'inter' },
            { label: 'Montserrat', value: 'montserrat' },
            { label: 'Manrope', value: 'manrope' },
            { label: 'Golos Text', value: 'golos' },
            { label: 'PT Sans', value: 'ptsans' },
            { label: 'Unbounded', value: 'unbounded' },
            { label: 'Roboto', value: 'roboto' },
          ],
        },
        {
          name: 'bodyFont',
          type: 'select',
          label: 'Шрифт текста',
          defaultValue: 'inter',
          options: [
            { label: 'Inter', value: 'inter' },
            { label: 'Montserrat', value: 'montserrat' },
            { label: 'Manrope', value: 'manrope' },
            { label: 'Golos Text', value: 'golos' },
            { label: 'PT Sans', value: 'ptsans' },
            { label: 'Roboto', value: 'roboto' },
          ],
        },
        {
          name: 'textSize',
          type: 'select',
          label: 'Размер текста',
          defaultValue: '18',
          options: [
            { label: '18px', value: '18' },
            { label: '20px', value: '20' },
            { label: '22px', value: '22' },
            { label: '24px', value: '24' },
          ],
        },
        {
          name: 'textWeight',
          type: 'select',
          label: 'Насыщенность текста',
          defaultValue: '400',
          options: [
            { label: 'Light', value: '300' },
            { label: 'Normal', value: '400' },
          ],
        },
        {
          name: 'headingWeight',
          type: 'select',
          label: 'Насыщенность заголовков',
          defaultValue: '700',
          options: [
            { label: 'Light', value: '300' },
            { label: 'Normal', value: '400' },
            { label: 'Medium', value: '500' },
            { label: 'Semibold', value: '600' },
            { label: 'Bold', value: '700' },
          ],
        },
      ],
    },
    {
      name: 'heroTeam',
      type: 'group',
      label: 'Блок участников (главная)',
      admin: { description: 'Если список участников пуст — блок не отображается.' },
      fields: [
        {
          name: 'members',
          type: 'array',
          label: 'Участники',
          labels: { singular: 'Участник', plural: 'Участники' },
          fields: [
            { name: 'photo', type: 'upload', relationTo: 'media', label: 'Фото', required: true },
            { name: 'name', type: 'text', label: 'Имя', admin: { description: 'Для alt-текста.' } },
            {
              name: 'category',
              type: 'relationship',
              relationTo: 'categories',
              label: 'Ссылка на категорию',
              admin: { description: 'Клик по аватару ведёт на эту категорию. Можно оставить пустым.' },
            },
          ],
        },
        {
          name: 'caption',
          type: 'textarea',
          label: 'Подпись',
          admin: { description: 'Текст справа от аватаров. Переносы строк сохраняются.' },
        },
        {
          name: 'avatarSize',
          type: 'select',
          label: 'Размер аватаров',
          defaultValue: '96',
          options: [
            { label: 'Мелкие (48px)', value: '48' },
            { label: 'Средние (64px)', value: '64' },
            { label: 'Крупные (96px)', value: '96' },
            { label: 'Очень крупные (128px)', value: '128' },
          ],
        },
      ],
    },
    {
      name: 'hero',
      type: 'group',
      label: 'Заголовок главной (Hero)',
      admin: {
        description: 'Тексты верхнего блока главной. Если поля пустые — показываются значения по умолчанию.',
      },
      fields: [
        {
          name: 'eyebrow',
          type: 'text',
          label: 'Надпись над заголовком',
          admin: { description: 'Мелкая надпись-бейдж над слоганом. Пусто — значение по умолчанию.' },
        },
        {
          name: 'titleLines',
          type: 'textarea',
          label: 'Заголовок-слоган',
          admin: {
            description:
              'Каждая строка — отдельная строка заголовка. Последняя строка выделяется градиентом. Пусто — значение по умолчанию.',
          },
        },
      ],
    },
    {
      name: 'videoProfile',
      type: 'select',
      defaultValue: 'balanced',
      label: 'Профиль сжатия видео',
      options: [
        { label: 'Баланс', value: 'balanced' },
        { label: 'Быстро', value: 'fast' },
        { label: 'Компактно', value: 'compact' },
        { label: 'Качество', value: 'quality' },
      ],
      admin: { description: 'Профиль кодирования для новых загруженных видео. Действует на новые загрузки, уже обработанные не меняет.' },
    },
    {
      name: 'videoRenditions',
      type: 'text',
      defaultValue: '480,720',
      label: 'Хранимые разрешения видео',
      admin: { description: 'Какие дорожки генерировать для новых видео (CSV из 480,720,1080). 1080 — самый тяжёлый по месту, включайте где действительно нужно. Действует на новые загрузки.' },
    },
    {
      name: 'heroChips',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      label: 'Категории в шапке',
      admin: {
        description: 'Чипсы под заголовком главной. Порядок задаётся перетаскиванием.',
      },
    },
    {
      name: 'homeCategories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      label: 'Категории на главной (плитки)',
      admin: {
        description: 'Блок «Категории». Если пусто — блок не отображается.',
      },
    },
    {
      name: 'homeSections',
      type: 'array',
      label: 'Секции главной страницы',
      labels: { singular: 'Секция', plural: 'Секции' },
      admin: {
        description:
          'Порядок и видимость секций главной. Порядок задаётся перетаскиванием. ' +
          'Если список пуст — показываются все секции в порядке по умолчанию. ' +
          'Секции, зависящие от данных (участники, категории), скрываются автоматически при отсутствии данных, даже если включены.',
      },
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          label: 'Секция',
          options: HOME_SECTION_OPTIONS,
        },
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Показывать',
          defaultValue: true,
        },
        {
          name: 'config',
          type: 'json',
          label: 'Настройки секции',
          admin: {
            description:
              'Заголовок, вариант вёрстки, тема и источник контента секции. Редактируется в студии.',
          },
        },
      ],
    },
    {
      name: 'banner',
      type: 'group',
      label: 'Баннер «ON AIR» (главная)',
      admin: {
        description: 'Тексты финального баннера главной. Если поля пустые — показываются значения по умолчанию.',
      },
      fields: [
        {
          name: 'tagline',
          type: 'text',
          label: 'Надпись сверху',
          admin: { description: 'Мелкая надпись над «ON AIR». Пусто — значение по умолчанию.' },
        },
        {
          name: 'onAirText',
          type: 'text',
          label: 'Крупный текст',
          admin: { description: 'Крупная неоновая надпись. Пусто — значение по умолчанию.' },
        },
      ],
    },
    {
      name: 'socials',
      type: 'array',
      label: 'Соцсети',
      labels: { singular: 'Соцсеть', plural: 'Соцсети' },
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          options: [
            { label: 'Boosty', value: 'boosty' },
            { label: 'VK', value: 'vk' },
            { label: 'Telegram', value: 'telegram' },
            { label: 'YouTube', value: 'youtube' },
            { label: 'Instagram', value: 'instagram' },
            { label: 'TikTok', value: 'tiktok' },
            { label: 'X (Twitter)', value: 'x' },
            { label: 'Facebook', value: 'facebook' },
            { label: 'Одноклассники', value: 'ok' },
            { label: 'Дзен', value: 'dzen' },
            { label: 'RUTUBE', value: 'rutube' },
            { label: 'Twitch', value: 'twitch' },
            { label: 'Discord', value: 'discord' },
            { label: 'WhatsApp', value: 'whatsapp' },
          ],
        },
        { name: 'url', type: 'text', required: true },
        {
          name: 'description',
          type: 'text',
          label: 'Подпись',
          admin: { description: 'Короткое описание под названием (напр. «Анонсы и новые видео»). Пусто — подпись по умолчанию для площадки.' },
        },
      ],
    },
    {
      name: 'whyUs',
      type: 'json',
      label: '«Почему мы» — карточки',
      admin: {
        description:
          'Карточки блока «Почему мы» на главной: массив [{ icon, title, text }]. Управляется в конструкторе главной. Пусто — карточки по умолчанию.',
      },
    },
    {
      name: 'seoDefaults',
      type: 'group',
      label: 'SEO по умолчанию',
      fields: [
        { name: 'titleTemplate', type: 'text', admin: { description: 'напр. "%s — COCO JAMBO"' } },
        { name: 'description', type: 'textarea' },
        { name: 'ogImage', type: 'upload', relationTo: 'media' },
      ],
    },
    {
      name: 'navigation',
      type: 'array',
      label: 'Навигация',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
    {
      name: 'footer',
      type: 'group',
      label: 'Футер',
      fields: [
        { name: 'text', type: 'textarea' },
        { name: 'copyright', type: 'text' },
      ],
    },
    // Водяная метка дайджеста: до этого момента материалы уже разосланы.
    // Двигает планировщик рассылки — правится только сервером.
    {
      name: 'lastDigestAt',
      type: 'date',
      label: 'Последний дайджест отправлен',
      access: { create: () => false, update: () => false },
      admin: { readOnly: true, description: 'Служебное поле планировщика рассылки.' },
    },
  ],
  timestamps: true,
}
