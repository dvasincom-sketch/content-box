import type { Access, CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'

/**
 * CustomThemes — библиотека пользовательских палитр тенанта. Автор собирает свою
 * тему (цвета для светлой и тёмной версий) и активирует её; активная перекрывает
 * цвета пресета/шаблона (см. resolveThemeColors + layout). Пишется из студии
 * через роуты с overrideAccess; шрифты в MVP остаются от пресета/шаблона.
 *
 * Поле `theme` (json): { dark: {bg,surface,primary,accent,text,header?},
 *                        light: {...} }.
 */
const scoped: Access = ({ req: { user } }) => {
  if (isSuperAdmin(user)) return true
  const t = getUserTenantID(user)
  return t ? { tenant: { equals: t } } : false
}

export const CustomThemes: CollectionConfig = {
  slug: 'custom-themes',
  labels: { singular: 'Своя тема', plural: 'Свои темы' },
  admin: {
    useAsTitle: 'name',
    group: 'Оформление',
    defaultColumns: ['name', 'updatedAt'],
    description: 'Пользовательские палитры (свет/тьма). Управляются из студии.',
  },
  access: {
    read: scoped,
    create: () => false, // только студия через overrideAccess
    update: () => false,
    delete: ({ req: { user } }) => isSuperAdmin(user),
  },
  fields: [
    { name: 'name', type: 'text', label: 'Название', required: true },
    { name: 'theme', type: 'json', label: 'Палитра (свет/тьма)' },
    // `tenant` инжектит multi-tenant плагин.
  ],
  timestamps: true,
}
