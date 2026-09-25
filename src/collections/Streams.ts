import type { CollectionConfig, CollectionBeforeChangeHook, Access, FieldAccess } from 'payload'
import { ownerField, stampOwner, isSuperAdmin, isFullStaff, getUserTenantID } from '../access'
import { slugify } from '../lib/slugify'

/**
 * Streams — прямые трансляции (Castr). Автор стримит через OBS → Castr, наш сайт
 * — витрина: показываем эфир по подписке, чат, Hero на главной. С Castr по API НЕ
 * общаемся: владелец вставляет ссылку просмотра и (для удобства) данные OBS.
 *
 * Статус — ПО ВРЕМЕНИ: до scheduledAt «Скоро», в [scheduledAt, endsAt) «В эфире»,
 * после — завершён/повтор. Создаёт только владелец. Доступ — ВСЕГДА по тарифу.
 * Пока — одна активная трансляция. Группа админки: «Контент».
 */

// Доступ к коллекции (студия/REST): только владелец студии/суперадмин, в пределах
// своего тенанта. Публичный фронт читает через overrideAccess (как у видео).
const staffOnly: Access = ({ req: { user } }) => {
  const u = user as unknown as Parameters<typeof isSuperAdmin>[0]
  if (isSuperAdmin(u)) return true
  const tid = getUserTenantID(u)
  if (!tid) return false
  if (isFullStaff(u)) return { tenant: { equals: tid } }
  return false
}

// Секретные поля OBS (сервер/ключ) читает только персонал. overrideAccess их
// обходит (серверный рендер), поэтому во фронте эти поля клиенту НЕ передаём.
const staffFieldRead: FieldAccess = ({ req: { user } }) => {
  const u = user as unknown as Parameters<typeof isSuperAdmin>[0]
  return isFullStaff(u) || isSuperAdmin(u)
}

// Slug из названия, если не задан.
const autoSlug: CollectionBeforeChangeHook = ({ data }) => {
  if (data && !data.slug && data.title) data.slug = slugify(String(data.title)) || String(Date.now())
  return data
}

export const Streams: CollectionConfig = {
  slug: 'streams',
  labels: { singular: 'Трансляция', plural: 'Трансляции' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'scheduledAt', 'endsAt', 'minTier'],
    group: 'Контент',
    description: 'Прямые трансляции (Castr): доступ по подписке, чат, Hero на главной.',
  },
  access: { read: staffOnly, create: staffOnly, update: staffOnly, delete: staffOnly },
  fields: [
    ownerField,
    { name: 'title', type: 'text', required: true, label: 'Название' },
    { name: 'slug', type: 'text', required: true, index: true, label: 'Slug' },
    {
      name: 'scheduledAt',
      type: 'date',
      required: true,
      label: 'Начало (запланированное время)',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'endsAt',
      type: 'date',
      required: true,
      label: 'Окончание',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description:
          'Когда эфир считается завершённым. По времени: до начала — «Скоро», между началом и окончанием — «В эфире», после — «завершён».',
      },
    },
    { name: 'cover', type: 'upload', relationTo: 'media', label: 'Обложка' },
    {
      name: 'minTier',
      type: 'relationship',
      relationTo: 'subscription-tiers',
      required: true,
      label: 'Уровень доступа',
      admin: { description: 'Трансляция доступна только по подписке — от этого уровня и выше.' },
    },
    { name: 'chatEnabled', type: 'checkbox', defaultValue: true, label: 'Чат включён' },
    {
      name: 'saveRecording',
      type: 'checkbox',
      defaultValue: false,
      label: 'Сохранить запись',
      admin: {
        description:
          'Запись включается в самом Castr. После эфира вставьте ссылку на запись ниже, чтобы показать повтор.',
      },
    },
    {
      name: 'playbackUrl',
      type: 'text',
      required: true,
      label: 'Ссылка просмотра (Castr)',
      admin: { description: 'Ссылка/embed от Castr, по которой зрители смотрят эфир у нас.' },
    },
    {
      name: 'ingestServer',
      type: 'text',
      label: 'OBS: сервер (RTMP)',
      access: { read: staffFieldRead },
      admin: { description: 'Из Castr. Копируется в OBS. Видно только в студии.' },
    },
    {
      name: 'ingestKey',
      type: 'text',
      label: 'OBS: ключ трансляции',
      access: { read: staffFieldRead },
      admin: { description: 'Из Castr. Секрет — копируется в OBS. Видно только в студии.' },
    },
    {
      name: 'recordingUrl',
      type: 'text',
      label: 'Ссылка на запись (Castr VOD)',
      admin: { description: 'Заполните после эфира, если сохраняли запись — покажем повтор.' },
    },
    // `tenant` инжектит multi-tenant плагин.
  ],
  hooks: {
    beforeChange: [stampOwner, autoSlug],
  },
  timestamps: true,
}
