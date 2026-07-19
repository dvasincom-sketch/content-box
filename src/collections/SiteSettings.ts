import type { CollectionConfig } from 'payload'
import { isSuperAdmin, getUserTenantID } from '../access'
import { HOME_SECTION_OPTIONS } from '../lib/homeSections'

/**
 * SiteSettings (ТЗ §3.3) — one record per tenant (branding, theme, SEO
 * defaults, nav, footer, socials). Runs as isGlobal via the multi-tenant
 * plugin so exactly one document exists per tenant. `tenant` field injected
 * by the plugin. Public read (front-end renders the branded shell).
 */
export const SiteSettings: CollectionConfig = {
  slug: 'site-settings',
  labels: { singular: 'Настройки сайта', plural: 'Настройки сайта' },
  admin: { useAsTitle: 'id' },
  access: {
    read: () => true,
    create: ({ req: { user } }) =>
      isSuperAdmin(user as any) || Boolean(getUserTenantID(user as any)),
    update: ({ req: { user } }) =>
      isSuperAdmin(user as any) || Boolean(getUserTenantID(user as any)),
    delete: ({ req: { user } }) =>
      isSuperAdmin(user as any) || Boolean(getUserTenantID(user as any)),
  },
  fields: [
    // `tenant` added by the multi-tenant plugin.
    { name: 'logo', type: 'upload', relationTo: 'media', label: 'Логотип' },
    {
      name: 'theme',
      type: 'group',
      label: 'Тема (токены)',
      fields: [
        { name: 'primary', type: 'text', admin: { description: 'напр. #7C3AED' } },
        { name: 'accent', type: 'text' },
        { name: 'background', type: 'text' },
        { name: 'surface', type: 'text' },
        { name: 'text', type: 'text' },
      ],
    },
    {
      name: 'typography',
      type: 'group',
      label: 'Типографика',
      fields: [
        {
          name: 'headingFont',
          type: 'select',
          label: 'Шрифт заголовков',
          defaultValue: 'inter',
          options: [
            { label: 'Inter', value: 'inter' },
            { label: 'Montserrat', value: 'montserrat' },
            { label: 'Manrope', value: 'manrope' },
            { label: 'Golos Text', value: 'golos' },
            { label: 'PT Sans', value: 'ptsans' },
            { label: 'Unbounded', value: 'unbounded' },
            { label: 'Roboto', value: 'roboto' },
          ],
        },
        {
          name: 'bodyFont',
          type: 'select',
          label: 'Шрифт текста',
          defaultValue: 'inter',
          options: [
            { label: 'Inter', value: 'inter' },
            { label: 'Montserrat', value: 'montserrat' },
            { label: 'Manrope', value: 'manrope' },
            { label: 'Golos Text', value: 'golos' },
            { label: 'PT Sans', value: 'ptsans' },
            { label: 'Roboto', value: 'roboto' },
          ],
        },
        {
          name: 'textSize',
          type: 'select',
          label: 'Размер текста',
          defaultValue: '18',
          options: [
            { label: '18px', value: '18' },
            { label: '20px', value: '20' },
            { label: '22px', value: '22' },
            { label: '24px', value: '24' },
          ],
        },
        {
          name: 'textWeight',
          type: 'select',
          label: 'Насыщенность текста',
          defaultValue: '400',
          options: [
            { label: 'Light', value: '300' },
            { label: 'Normal', value: '400' },
          ],
        },
        {
          name: 'headingWeight',
          type: 'select',
          label: 'Насыщенность заголовков',
          defaultValue: '700',
          options: [
            { label: 'Light', value: '300' },
            { label: 'Normal', value: '400' },
            { label: 'Medium', value: '500' },
            { label: 'Semibold', value: '600' },
            { label: 'Bold', value: '700' },
          ],
        },
      ],
    },
    {
      name: 'heroTeam',
      type: 'group',
      label: 'Блок участников (главная)',
      admin: { description: 'Если список участников пуст — блок не отображается.' },
      fields: [
        {
          name: 'members',
          type: 'array',
          label: 'Участники',
          labels: { singular: 'Участник', plural: 'Участники' },
          fields: [
            { name: 'photo', type: 'upload', relationTo: 'media', label: 'Фото', required: true },
            { name: 'name', type: 'text', label: 'Имя', admin: { description: 'Для alt-текста.' } },
            {
              name: 'category',
              type: 'relationship',
              relationTo: 'categories',
              label: 'Ссылка на категорию',
              admin: { description: 'Клик по аватару ведёт на эту категорию. Можно оставить пустым.' },
            },
          ],
        },
        {
          name: 'caption',
          type: 'textarea',
          label: 'Подпись',
          admin: { description: 'Текст справа от аватаров. Переносы строк сохраняются.' },
        },
        {
          name: 'avatarSize',
          type: 'select',
          label: 'Размер аватаров',
          defaultValue: '96',
          options: [
            { label: 'Мелкие (48px)', value: '48' },
            { label: 'Средние (64px)', value: '64' },
            { label: 'Крупные (96px)', value: '96' },
            { label: 'Очень крупные (128px)', value: '128' },
          ],
        },
      ],
    },
    {
      name: 'hero',
      type: 'group',
      label: 'Заголовок главной (Hero)',
      admin: {
        description: 'Тексты верхнего блока главной. Если поля пустые — показываются значения по умолчанию.',
      },
      fields: [
        {
          name: 'eyebrow',
          type: 'text',
          label: 'Надпись над заголовком',
          admin: { description: 'Мелкая надпись-бейдж над слоганом. Пусто — значение по умолчанию.' },
        },
        {
          name: 'titleLines',
          type: 'textarea',
          label: 'Заголовок-слоган',
          admin: {
            description:
              'Каждая строка — отдельная строка заголовка. Последняя строка выделяется градиентом. Пусто — значение по умолчанию.',
          },
        },
      ],
    },
    {
      name: 'heroChips',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      label: 'Категории в шапке',
      admin: {
        description: 'Чипсы под заголовком главной. Порядок задаётся перетаскиванием.',
      },
    },
    {
      name: 'homeCategories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      label: 'Категории на главной (плитки)',
      admin: {
        description: 'Блок «Категории». Если пусто — блок не отображается.',
      },
    },
    {
      name: 'homeSections',
      type: 'array',
      label: 'Секции главной страницы',
      labels: { singular: 'Секция', plural: 'Секции' },
      admin: {
        description:
          'Порядок и видимость секций главной. Порядок задаётся перетаскиванием. ' +
          'Если список пуст — показываются все секции в порядке по умолчанию. ' +
          'Секции, зависящие от данных (участники, категории), скрываются автоматически при отсутствии данных, даже если включены.',
      },
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          label: 'Секция',
          options: HOME_SECTION_OPTIONS,
        },
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Показывать',
          defaultValue: true,
        },
      ],
    },
    {
      name: 'socials',
      type: 'array',
      label: 'Соцсети',
      labels: { singular: 'Соцсеть', plural: 'Соцсети' },
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          options: [
            { label: 'Boosty', value: 'boosty' },
            { label: 'VK', value: 'vk' },
            { label: 'Telegram', value: 'telegram' },
            { label: 'YouTube', value: 'youtube' },
            { label: 'Instagram', value: 'instagram' },
          ],
        },
        { name: 'url', type: 'text', required: true },
      ],
    },
    {
      name: 'seoDefaults',
      type: 'group',
      label: 'SEO по умолчанию',
      fields: [
        { name: 'titleTemplate', type: 'text', admin: { description: 'напр. "%s — COCO JAMBO"' } },
        { name: 'description', type: 'textarea' },
        { name: 'ogImage', type: 'upload', relationTo: 'media' },
      ],
    },
    {
      name: 'navigation',
      type: 'array',
      label: 'Навигация',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
    {
      name: 'footer',
      type: 'group',
      label: 'Футер',
      fields: [
        { name: 'text', type: 'textarea' },
        { name: 'copyright', type: 'text' },
      ],
    },
  ],
  timestamps: true,
}
