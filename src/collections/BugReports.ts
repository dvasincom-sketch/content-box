import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'
import { awardActivity, reverseActivity } from '../lib/reputation'

/**
 * BugReports — сообщения об ошибках от пользователей (баг-баунти).
 *
 * Первые пользователи помогают ловить баги; за подтверждённую находку автор
 * получает очки репутации (та же лестница Новичок→Легенда). Модель начисления —
 * ГИБРИД: +1 очко сразу при отправке (авторизованному), основной бонус — когда
 * модератор в админке ставит `confirmed`. Начисление идёт через общий движок
 * `reputation.ts` (идемпотентно, журнал — `activity-events`).
 *
 * Отчёт может быть анонимным (пользователь согласился) — тогда `subscriber`
 * пуст и очки не начисляются (некому). Публичные отчёты создаёт СЕРВЕР из
 * `/api/bug-report` через overrideAccess после рейт-лимита и валидации, поэтому
 * прямой `create` через Payload открыт только персоналу (ручной ввод в админке).
 */
const scoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true
  const t = getUserTenantID(user)
  return t ? { tenant: { equals: t } } : false
}

/** id связи независимо от depth (число/строка или populated-объект). */
function relId(v: unknown): number | null {
  if (v == null) return null
  const raw = typeof v === 'object' ? (v as { id?: unknown }).id : v
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export const BugReports: CollectionConfig = {
  slug: 'bug-reports',
  labels: { singular: 'Баг-репорт', plural: 'Баг-репорты' },
  admin: {
    useAsTitle: 'description',
    group: 'Сообщество',
    defaultColumns: ['description', 'status', 'subscriber', 'pageUrl', 'createdAt'],
    description: 'Сообщения об ошибках от пользователей. Статус «Подтверждён» начисляет автору очки.',
  },
  access: {
    read: scoped,
    // Публичные (в т.ч. анонимные) отчёты пишет сервер из /api/bug-report через
    // overrideAccess. Напрямую в Payload создавать может только персонал.
    create: ({ req: { user } }) => isSuperAdmin(user) || Boolean(getUserTenantID(user)),
    update: scoped,
    delete: scoped,
  },
  fields: [
    { name: 'description', type: 'textarea', required: true, label: 'Описание ошибки' },
    { name: 'pageUrl', type: 'text', required: true, label: 'Страница (URL)' },
    { name: 'pageTitle', type: 'text', label: 'Заголовок страницы' },
    {
      name: 'subscriber',
      type: 'relationship',
      relationTo: 'subscribers',
      index: true,
      label: 'Пользователь',
      admin: { description: 'Пусто — отчёт анонимный или из студии.' },
    },
    {
      name: 'reporterUser',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      label: 'Сотрудник (студия)',
      admin: { description: 'Заполняется, если баг отправлен автором из студии.' },
    },
    { name: 'anonymous', type: 'checkbox', defaultValue: false, label: 'Анонимно' },
    {
      name: 'source',
      type: 'select',
      label: 'Откуда',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Сайт', value: 'site' },
        { label: 'Студия', value: 'studio' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      label: 'Статус',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Новый', value: 'new' },
        { label: 'Подтверждён', value: 'confirmed' },
        { label: 'Дубликат', value: 'duplicate' },
        { label: 'Отклонён', value: 'rejected' },
        { label: 'Исправлен', value: 'fixed' },
      ],
    },
    {
      name: 'severity',
      type: 'select',
      label: 'Критичность',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Мелкая', value: 'minor' },
        { label: 'Существенная', value: 'major' },
        { label: 'Критичная', value: 'critical' },
      ],
    },
    { name: 'moderatorNote', type: 'textarea', label: 'Заметка модератора' },
    { name: 'userAgent', type: 'text', label: 'User-Agent', admin: { readOnly: true } },
    { name: 'viewport', type: 'text', label: 'Экран', admin: { readOnly: true } },
    // `tenant` инжектит multi-tenant плагин.
  ],
  hooks: {
    afterChange: [
      // Начисление/откат очков при смене статуса. Best-effort: сбой очков не
      // должен ломать сохранение отчёта.
      async ({ req, doc, previousDoc, operation }) => {
        if (operation !== 'update') return
        const prev = (previousDoc as { status?: string })?.status
        const next = (doc as { status?: string })?.status
        if (prev === next) return

        const payload = req.payload
        const subId = relId((doc as { subscriber?: unknown }).subscriber)
        try {
          // Подтверждён → бонус автору (идемпотентно).
          if (next === 'confirmed' && subId != null) {
            await awardActivity(payload, {
              subscriberId: subId,
              type: 'bug_confirmed',
              refType: 'bug-report',
              refId: doc.id,
            })
          }
          // Дубликат/отклонён → забираем и стартовое очко, и бонус (если был).
          if (next === 'duplicate' || next === 'rejected') {
            await reverseActivity(payload, { type: 'bug_submitted', refType: 'bug-report', refId: doc.id })
            await reverseActivity(payload, { type: 'bug_confirmed', refType: 'bug-report', refId: doc.id })
          }
        } catch {
          /* очки best-effort */
        }
      },
    ],
  },
  timestamps: true,
}
