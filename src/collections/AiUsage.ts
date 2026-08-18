import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/**
 * AiUsage — журнал вызовов ассистента «Ася» по тенанту: на какой поверхности
 * (создание страниц / саммари субтитров / поддержка), сколько токенов потрачено.
 * Пишется ТОЛЬКО сервером (overrideAccess) после каждого вызова Аси; читается
 * staff для вкладки «AI» в настройках. Токены пока оценочные (estimated=true) —
 * поле готово принять точные значения, когда Ася начнёт возвращать usage.
 */
const scoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true
  const t = getUserTenantID(user)
  return t ? { tenant: { equals: t } } : false
}

export const AiUsage: CollectionConfig = {
  slug: 'ai-usage',
  labels: { singular: 'Событие ИИ', plural: 'Использование ИИ' },
  admin: {
    useAsTitle: 'id',
    group: 'Служебное',
    defaultColumns: ['surface', 'action', 'tokensTotal', 'createdAt'],
    description: 'Журнал вызовов Аси (служебное, только чтение).',
  },
  access: {
    read: scoped,
    create: () => false, // только сервер через overrideAccess
    update: () => false,
    delete: ({ req: { user } }) => isSuperAdmin(user),
  },
  fields: [
    {
      name: 'surface',
      type: 'select',
      required: true,
      label: 'Поверхность',
      options: [
        { label: 'Создание страниц', value: 'compose' },
        { label: 'Саммари субтитров', value: 'summary' },
        { label: 'Поддержка', value: 'support' },
      ],
    },
    { name: 'action', type: 'text', label: 'Действие' },
    { name: 'tokensIn', type: 'number', label: 'Токены (вход)', defaultValue: 0 },
    { name: 'tokensOut', type: 'number', label: 'Токены (выход)', defaultValue: 0 },
    { name: 'tokensTotal', type: 'number', label: 'Токены (всего)', defaultValue: 0, index: true },
    { name: 'estimated', type: 'checkbox', label: 'Оценка (не точные токены)', defaultValue: true },
    { name: 'ok', type: 'checkbox', label: 'Успех', defaultValue: true },
    { name: 'actorType', type: 'text', label: 'Актор' },
    { name: 'meta', type: 'text', label: 'Контекст' },
    // `tenant` инжектит multi-tenant плагин.
  ],
  timestamps: true,
}
