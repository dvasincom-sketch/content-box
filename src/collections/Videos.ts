import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

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
  if (isSuperAdmin(user as any)) return true
  const tenantID = getUserTenantID(user as any)
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
      isSuperAdmin(user as any) || Boolean(getUserTenantID(user as any)),
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
      ],
      admin: {
        description:
          'Где хранится видео. Stream — для зарубежной аудитории; Kinescope — для РФ (не блокируется провайдерами).',
      },
    },
    {
      name: 'videoRef',
      type: 'text',
      label: 'Ссылка/ключ видео',
      admin: {
        description:
          'Идентификатор видео в хранилище: CF Stream uid или Kinescope video_id (по provider).',
      },
    },
    {
      name: 'durationSec',
      type: 'number',
      label: 'Длительность, сек',
      min: 0,
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Дата публикации',
    },
    // `tenant` инжектит multi-tenant плагин.
  ],
  timestamps: true,
}
