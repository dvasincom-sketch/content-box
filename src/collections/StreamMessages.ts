import type { CollectionConfig, Access } from 'payload'
import { isSuperAdmin, isFullStaff, getUserTenantID } from '../access'

/**
 * Сообщения чата трансляций. Публичные чтение/запись идут через
 * /api/stream/chat с overrideAccess (проверка доступа по подписке — там).
 * Прямой доступ к коллекции (студия/REST) — только владельцу студии.
 * `name` денормализуем (имя подписчика на момент отправки), чтобы поллинг
 * чата не делал джойн на subscribers.
 */
const staffOnly: Access = ({ req: { user } }) => {
  const u = user as unknown as Parameters<typeof isSuperAdmin>[0]
  if (isSuperAdmin(u)) return true
  const tid = getUserTenantID(u)
  if (!tid) return false
  if (isFullStaff(u)) return { tenant: { equals: tid } }
  return false
}

export const StreamMessages: CollectionConfig = {
  slug: 'stream-messages',
  labels: { singular: 'Сообщение чата', plural: 'Чат трансляций' },
  admin: {
    useAsTitle: 'text',
    defaultColumns: ['name', 'text', 'stream', 'hidden', 'createdAt'],
    group: 'Контент',
  },
  access: { read: staffOnly, create: staffOnly, update: staffOnly, delete: staffOnly },
  fields: [
    { name: 'stream', type: 'relationship', relationTo: 'streams' as any, required: true, index: true, label: 'Трансляция' },
    { name: 'subscriber', type: 'relationship', relationTo: 'subscribers', index: true, label: 'Подписчик' },
    { name: 'name', type: 'text', label: 'Имя (снимок)' },
    { name: 'text', type: 'text', required: true, label: 'Текст' },
    { name: 'hidden', type: 'checkbox', defaultValue: false, label: 'Скрыто' },
    // `tenant` инжектит multi-tenant плагин.
  ],
  timestamps: true,
}
