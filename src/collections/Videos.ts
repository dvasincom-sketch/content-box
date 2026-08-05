import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'
import { tagsField, normalizeTags } from '../fields/tags'

/**
 * Videos — видеоконтент (лайвы, концерты, шоу) с доступом по уровню подписки.
 *
 * Доступ к просмотру определяется minTier: видео открыто подписчикам, чей
 * активный уровень имеет weight >= weight(minTier). Если minTier пуст ИЛИ
 * isPreview=true — доступно всем (в т.ч. без подписки). Сама проверка доступа
 * на выдаче видео будет во фронт-энде/гейтинге (следующий этап) — здесь только
 * модель данных.
 *
 * videoRef — заглушка под будущее хранилище (R2 / Stream / B2). Пока просто
 * строка (ключ объекта или ID). Тип не меняем при смене хранилища.
 *
 * Привязка к существующему дереву категорий (weverse-live, концерты, участники).
 * Группа админки: «Контент».
 */

const videosScoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true
  const tenantID = getUserTenantID(user)
  if (!tenantID) return false
  return { tenant: { equals: tenantID } }
}

export const Videos: CollectionConfig = {
  slug: 'videos',
  labels: { singular: 'Видео', plural: 'Видео' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'minTier', 'isPreview', 'publishedAt'],
    group: 'Контент',
    description: 'Видеоконтент с доступом по уровню подписки.',
  },
  access: {
    read: videosScoped,
    create: ({ req: { user } }) =>
      isSuperAdmin(user) || Boolean(getUserTenantID(user)),
    update: videosScoped,
    delete: videosScoped,
  },
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Название' },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      label: 'Slug',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Описание / анонс',
    },
    { name: 'cover', type: 'upload', relationTo: 'media', label: 'Обложка' },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      label: 'Категория',
      admin: { description: 'Раздел дерева: weverse-live, концерты, участник...' },
    },
    {
      name: 'folder',
      type: 'relationship',
      relationTo: 'video-folders',
      label: 'Папка',
      admin: {
        description: 'Папка для группировки видео в студии. Одно видео — одна папка.',
      },
    },
    {
      name: 'minTier',
      type: 'relationship',
      relationTo: 'subscription-tiers',
      label: 'Минимальный уровень доступа',
      admin: {
        description: 'Пусто = доступно всем бесплатно. Иначе — от этого уровня и выше.',
      },
    },
    {
      name: 'isPreview',
      type: 'checkbox',
      defaultValue: false,
      label: 'Бесплатное превью',
      admin: {
        description: 'Открыто всем, даже без подписки (перебивает minTier).',
      },
    },
    {
      name: 'provider',
      type: 'select',
      required: true,
      defaultValue: 'stream',
      label: 'Видеопровайдер',
      options: [
        { label: 'Cloudflare Stream (зарубежный)', value: 'stream' },
        { label: 'Kinescope (российский)', value: 'kinescope' },
        { label: 'Внешняя ссылка (VK, Дзен)', value: 'embed' },
        { label: 'Аудио (MP3)', value: 'audio' },
      ],
      // Выбрать 'embed' руками нельзя: адрес плеера заполняет сервер после
      // разбора ссылки, и запись без него будет неиграбельной. Такие видео
      // создаются в студии кнопкой «Не хранить».
      validate: (value: unknown, { data }: { data?: { embedSrc?: unknown; audioSrc?: unknown } }) => {
        if (value === 'embed' && !data?.embedSrc) {
          return 'Видео по внешней ссылке добавляется в студии — там разбирается ссылка и проверяется площадка.'
        }
        if (value === 'audio' && !data?.audioSrc) {
          return 'Аудио добавляется в студии загрузкой MP3-файла.'
        }
        return true
      },
      admin: {
        description:
          'Где хранится видео. Stream — для зарубежной аудитории; Kinescope — для РФ (не блокируется провайдерами); внешняя ссылка — видео лежит на чужой площадке и НЕ защищается подпиской.',
      },
    },
    {
      name: 'videoRef',
      type: 'text',
      label: 'Ссылка/ключ видео',
      admin: {
        description:
          'Идентификатор видео в хранилище: CF Stream uid или Kinescope video_id (по provider). Для внешней ссылки не используется — см. поля ниже.',
      },
    },
    // ── Внешняя вставка (provider = 'embed') ────────────────────────────────
    // Хранится РАЗОБРАННЫМ, а не куском HTML: сырой код вставки от автора в
    // разметке страницы — это XSS. Разбор и проверку хоста по белому списку
    // делает src/lib/videoEmbed.ts, iframe собираем сами.
    // ВАЖНО: embedProvider и embedSrc пишет ТОЛЬКО сервер (overrideAccess) после
    // разбора ссылки. `readOnly` в admin прячет поле лишь из интерфейса — без
    // field-access любой пользователь тенанта мог бы через
    // `PATCH /api/videos/<id>` подставить произвольный адрес и получить на своём
    // же домене iframe чужого сайта: фишинг под брендом площадки. Ровно эта
    // ошибка уже была с activeTier у подписчиков, см. Subscribers.ts.
    {
      name: 'embedProvider',
      type: 'select',
      label: 'Площадка',
      options: [
        { label: 'VK Видео', value: 'vk' },
        { label: 'VK Клип', value: 'vk-clip' },
        { label: 'Дзен', value: 'dzen' },
      ],
      access: { create: () => false, update: () => false },
      admin: {
        condition: (data) => data?.provider === 'embed',
        readOnly: true,
        description: 'Определяется автоматически по вставленной ссылке.',
      },
    },
    {
      name: 'embedSrc',
      type: 'text',
      label: 'Адрес плеера',
      access: { create: () => false, update: () => false },
      admin: {
        condition: (data) => data?.provider === 'embed',
        readOnly: true,
        description:
          'Нормализованный src для iframe. Заполняется сервером после разбора ссылки: белый список хостов проверяется там, поэтому руками поле не редактируется.',
      },
    },
    {
      name: 'embedAspect',
      type: 'select',
      defaultValue: '16:9',
      label: 'Пропорции',
      options: [
        { label: 'Горизонтальное 16:9', value: '16:9' },
        { label: 'Вертикальное 9:16 (клип)', value: '9:16' },
      ],
      admin: {
        condition: (data) => data?.provider === 'embed',
        description: 'Подставляется по типу ссылки; можно поправить вручную.',
      },
    },
    // ── Аудио (provider = 'audio') ──────────────────────────────────────────
    // MP3 лежит в S3 (загружается в студии), audioSrc — публичный URL файла.
    // Как и embedSrc, пишет ТОЛЬКО сервер (overrideAccess) после загрузки;
    // `readOnly`/field-access закрывают правку руками.
    {
      name: 'audioSrc',
      type: 'text',
      label: 'Файл аудио (URL в хранилище)',
      access: { create: () => false, update: () => false },
      admin: {
        condition: (data) => data?.provider === 'audio',
        readOnly: true,
        description: 'Ссылка на MP3 в хранилище. Заполняется сервером при загрузке файла.',
      },
    },
    {
      name: 'durationSec',
      type: 'number',
      label: 'Длительность, сек',
      min: 0,
    },
    {
      name: 'season',
      type: 'number',
      label: 'Сезон',
      min: 0,
      admin: { description: 'Номер сезона в видео-плейлисте. Пусто = вне сезона.' },
    },
    {
      name: 'episode',
      type: 'number',
      label: 'Эпизод (порядок)',
      min: 0,
      admin: { description: 'Порядок серии внутри сезона/плейлиста (по возрастанию).' },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Дата публикации',
    },
    tagsField,
    // `tenant` инжектит multi-tenant плагин.
  ],
  hooks: {
    // Свободные теги: тримим label и считаем slug (slugify), убираем дубли.
    beforeChange: [({ data }) => normalizeTags(data)],
  },
  timestamps: true,
}
