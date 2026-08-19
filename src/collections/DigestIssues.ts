import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/**
 * DigestIssues — история выпусков дайджеста по тенанту и отклик на них.
 * Пишется ТОЛЬКО сервером (overrideAccess) при рассылке дайджеста; читается
 * владельцем для вкладки «Рассылки» в аналитике. Открытия/клики считаются
 * собственным трекингом (пиксель `/api/n/o/:id`, редирект `/api/n/c/:id`),
 * без внешнего Listmonk. Счётчики сырые (не уникальные) — этого достаточно
 * для отклика на выпуск; поле `html` хранит тело письма, чтобы владелец мог
 * открыть сам выпуск.
 */
const scoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true
  const t = getUserTenantID(user)
  return t ? { tenant: { equals: t } } : false
}

export const DigestIssues: CollectionConfig = {
  slug: 'digest-issues',
  labels: { singular: 'Выпуск дайджеста', plural: 'Выпуски дайджеста' },
  admin: {
    useAsTitle: 'subject',
    group: 'Служебное',
    defaultColumns: ['subject', 'recipients', 'opens', 'clicks', 'createdAt'],
    description: 'История выпусков дайджеста и отклик (служебное, только чтение).',
  },
  access: {
    read: scoped,
    create: () => false, // только сервер через overrideAccess
    update: () => false,
    delete: ({ req: { user } }) => isSuperAdmin(user),
  },
  fields: [
    { name: 'subject', type: 'text', label: 'Тема', required: true },
    { name: 'html', type: 'textarea', label: 'HTML письма' },
    { name: 'sentAt', type: 'date', label: 'Отправлено', index: true },
    { name: 'recipients', type: 'number', label: 'Получателей', defaultValue: 0 },
    { name: 'itemsCount', type: 'number', label: 'Материалов', defaultValue: 0 },
    { name: 'opens', type: 'number', label: 'Открытий', defaultValue: 0 },
    { name: 'clicks', type: 'number', label: 'Кликов', defaultValue: 0 },
    // `tenant` инжектит multi-tenant плагин.
  ],
  timestamps: true,
}
