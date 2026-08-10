import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'
import { contentAccess, ownerField, stampOwner } from '../access'
import { activityAfterChange, activityAfterDelete } from '../lib/logActivity'
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

/**
 * Правило доступа к видео в зависимости от того, ГДЕ лежит файл (beforeChange).
 *
 * Внешняя вставка (provider='embed') — видео физически на чужой площадке
 * (VK, Дзен). Закрыть его подпиской технически невозможно: браузер грузит
 * плеер с чужого домена, адрес и ключ доступа видны в исходнике страницы.
 * Поэтому такое видео ВСЕГДА бесплатно для всех — иначе автор мог бы выдать
 * открытое VK-видео за платный материал (нечестно к подписчикам).
 *
 * Своё хранилище (stream/kinescope/audio) — файл занимает наши диски и
 * проходит наш транскодинг. Раздавать это бесплатно = дарить чужим ресурсы
 * платформы, поэтому «бесплатное превью» для него запрещено. Отсутствие
 * уровня трактуется как «нужна любая активная подписка» (см. checkVideoAccess).
 */
const enforceAccessPolicy: CollectionBeforeChangeHook = ({ data }) => {
  if (!data) return data
  if (data.provider === 'embed') {
    data.isPreview = true
    data.minTier = null
  } else if (data.provider != null) {
    data.isPreview = false
  }
  return data
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
  access: contentAccess('videos'),
  fields: [
    ownerField,
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
        description:
          'От этого уровня и выше. Для СВОЕГО видео пусто ≠ бесплатно: без ' +
          'уровня оно требует любую активную подписку. Для внешней вставки ' +
          'уровень игнорируется — она всегда бесплатна.',
      },
    },
    {
      name: 'isPreview',
      type: 'checkbox',
      defaultValue: false,
      label: 'Бесплатное превью',
      admin: {
        description:
          'Открыто всем, даже без подписки. Устанавливается автоматически: ' +
          'внешняя вставка — всегда бесплатна, своё видео (наше хранилище) — ' +
          'никогда (нагружает наши диски и транскодинг). См. хук enforceAccessPolicy.',
      },
    },
    {
      name: 'provider',
      type: 'select',
      required: true,
      defaultValue: 'stream',
      label: 'Видеопровайдер',
      options: [
        { label: 'Своё хранилище (Timeweb, HLS)', value: 'self' },
        { label: 'Cloudflare Stream (зарубежный)', value: 'stream' },
        { label: 'Kinescope (российский)', value: 'kinescope' },
        { label: 'Внешняя ссылка (VK, Дзен)', value: 'embed' },
        { label: 'Аудио (MP3)', value: 'audio' },
      ],
      // Выбрать 'embed' руками нельзя: адрес плеера заполняет сервер после
      // разбора ссылки, и запись без него будет неиграбельной. Такие видео
      // создаются в студии кнопкой «Не хранить».
      validate: (value: unknown, { data }: { data?: { embedSrc?: unknown; audioSrc?: unknown; playbackId?: unknown } }) => {
        if (value === 'embed' && !data?.embedSrc) {
          return 'Видео по внешней ссылке добавляется в студии — там разбирается ссылка и проверяется площадка.'
        }
        if (value === 'audio' && !data?.audioSrc) {
          return 'Аудио добавляется в студии загрузкой MP3-файла.'
        }
        if (value === 'self' && !data?.playbackId) {
          return 'Своё видео создаётся в студии загрузкой файла — сервер присваивает playbackId после заливки.'
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
    {
      name: 'embedStatus',
      type: 'text',
      label: 'Статус вставки',
      access: { create: () => false, update: () => false },
      admin: {
        condition: (data) => data?.provider === 'embed',
        readOnly: true,
        description: 'Автопроверка доступности внешнего видео: ok / unavailable / unknown. Заполняется валидатором (/api/videos/validate).',
      },
    },
    {
      name: 'embedCheckedAt',
      type: 'date',
      label: 'Проверено',
      access: { create: () => false, update: () => false },
      admin: { condition: (data) => data?.provider === 'embed', readOnly: true },
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
    // ── Своё хранилище (provider = 'self') ──────────────────────────────────
    // HLS-конвейер на Timeweb S3. Все поля пишет ТОЛЬКО сервер: студия при
    // заливке (originalKey), воркер-транскод через webhook (playbackId и
    // артефакты). Правку руками закрываем field-access + readOnly.
    {
      name: 'assetStatus',
      type: 'select',
      label: 'Статус обработки',
      defaultValue: 'processing',
      access: { create: () => false, update: () => false },
      options: [
        { label: 'Загружается', value: 'uploading' },
        { label: 'Обрабатывается', value: 'processing' },
        { label: 'Готово', value: 'ready' },
        { label: 'Ошибка', value: 'error' },
      ],
      admin: {
        condition: (data) => data?.provider === 'self',
        readOnly: true,
        description: 'Состояние транскодинга: uploading → processing → ready/error. Ставит сервер и воркер.',
      },
    },
    {
      name: 'playbackId',
      type: 'text',
      label: 'Playback ID',
      index: true,
      access: { create: () => false, update: () => false },
      admin: { condition: (data) => data?.provider === 'self', readOnly: true },
    },
    {
      name: 'originalKey',
      type: 'text',
      label: 'Ключ оригинала в S3',
      access: { create: () => false, update: () => false },
      admin: { condition: (data) => data?.provider === 'self', readOnly: true },
    },
    {
      name: 'posterKey',
      type: 'text',
      label: 'Постер (ключ S3)',
      access: { create: () => false, update: () => false },
      admin: { condition: (data) => data?.provider === 'self', readOnly: true },
    },
    {
      name: 'spriteKey',
      type: 'text',
      label: 'Storyboard (ключ S3)',
      access: { create: () => false, update: () => false },
      admin: { condition: (data) => data?.provider === 'self', readOnly: true },
    },
    {
      name: 'gifKey',
      type: 'text',
      label: 'GIF-превью (ключ S3)',
      access: { create: () => false, update: () => false },
      admin: { condition: (data) => data?.provider === 'self', readOnly: true },
    },
    {
      name: 'renditions',
      type: 'json',
      label: 'Рендишены (HLS)',
      access: { create: () => false, update: () => false },
      admin: {
        condition: (data) => data?.provider === 'self',
        readOnly: true,
        description: 'Массив { height, bandwidth, key } — залитые воркером варианты качества.',
      },
    },
    {
      name: 'assetError',
      type: 'text',
      label: 'Ошибка обработки',
      access: { create: () => false, update: () => false },
      admin: { condition: (data) => data?.provider === 'self', readOnly: true },
    },
    {
      name: 'assetBytes',
      type: 'number',
      label: 'Размер в хранилище (байты)',
      access: { create: () => false, update: () => false },
      admin: { condition: (data) => data?.provider === 'self', readOnly: true },
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
    beforeChange: [stampOwner, enforceAccessPolicy, ({ data }) => normalizeTags(data)],
    afterChange: [activityAfterChange('video')],
    afterDelete: [activityAfterDelete('video')],
  },
  timestamps: true,
}
