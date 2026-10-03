import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/**
 * AsyaQuestions — журнал реальных диалогов с Асей в панели «Спросить Асю»:
 * вопрос подписчика, ответ Аси, найденные видео и оценка 👍/👎. Нужен для
 * обратной связи: владелец видит, что спрашивают, где Ася «не знает» (нет
 * совпадений) и какие ответы оценили плохо — и улучшает контент/знание.
 *
 * Пишется ТОЛЬКО сервером (overrideAccess) из /api/ask; оценка проставляется
 * из /api/ask/feedback самим спросившим подписчиком. Читается владельцем на
 * экране «Аналитика → Ася» (через прямой SQL).
 */
const scoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true
  const t = getUserTenantID(user)
  return t ? { tenant: { equals: t } } : false
}

export const AsyaQuestions: CollectionConfig = {
  slug: 'asya-questions',
  labels: { singular: 'Вопрос Асе', plural: 'Вопросы Асе' },
  admin: {
    useAsTitle: 'question',
    group: 'Служебное',
    defaultColumns: ['question', 'hadMatches', 'rating', 'createdAt'],
    description: 'Журнал диалогов с Асей (служебное, только чтение).',
  },
  access: {
    read: scoped,
    create: () => false, // только сервер через overrideAccess
    update: () => false, // оценка — только сервер (/api/ask/feedback)
    delete: ({ req: { user } }) => isSuperAdmin(user),
  },
  fields: [
    { name: 'question', type: 'textarea', required: true, label: 'Вопрос' },
    { name: 'answer', type: 'textarea', label: 'Ответ Аси' },
    { name: 'matches', type: 'json', label: 'Найденные видео' },
    { name: 'hadMatches', type: 'checkbox', label: 'Нашлись видео', defaultValue: false, index: true },
    { name: 'context', type: 'text', label: 'Где спросили (страница)' },
    { name: 'subscriber', type: 'relationship', relationTo: 'subscribers', label: 'Подписчик', index: true },
    {
      name: 'rating',
      type: 'select',
      label: 'Оценка',
      options: [
        { label: '👍 Помогло', value: 'up' },
        { label: '👎 Не помогло', value: 'down' },
      ],
    },
    { name: 'ratingComment', type: 'textarea', label: 'Комментарий к оценке' },
    // `tenant` инжектит multi-tenant плагин.
  ],
  timestamps: true,
}
