import type { CollectionConfig } from 'payload'
import { publicReadTenantWrite } from '../access'

/**
 * Pages (ТЗ §3.6) — редактируемые клиентом текстовые страницы.
 * На этапе 1: richText-контент (О проекте, FAQ, Правила, Расписание эфира).
 * Поле `blocks` из задела убрано — блочный конструктор отложен (ТЗ §8).
 * Меню и футер строятся из этих страниц по флагам showInMenu / showInFooter.
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Страница', plural: 'Страницы' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'showInMenu', 'showInFooter', 'menuOrder'],
    description: 'Текстовые страницы сайта — редактируются клиентом.',
  },
  access: publicReadTenantWrite,
  fields: [
    // `tenant` добавляется плагином multi-tenant.
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Заголовок',
      admin: { description: 'Отображается как H1 и в меню.' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      label: 'URL (slug)',
      admin: { description: 'Адрес страницы: /page/about, /page/faq и т.д.' },
    },
    {
      name: 'content',
      type: 'richText',
      label: 'Содержимое',
      admin: { description: 'Тело страницы. Форматирование как в редакторе.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'showInMenu',
          type: 'checkbox',
          label: 'В меню (шапка)',
          defaultValue: false,
          admin: { width: '33%' },
        },
        {
          name: 'showInFooter',
          type: 'checkbox',
          label: 'В футере',
          defaultValue: false,
          admin: { width: '33%' },
        },
        {
          name: 'menuOrder',
          type: 'number',
          label: 'Порядок',
          defaultValue: 0,
          admin: { width: '33%', description: 'Сортировка в меню/футере.' },
        },
      ],
    },
    {
      name: 'footerColumn',
      type: 'select',
      label: 'Колонка футера',
      defaultValue: 'nav',
      options: [
        { label: 'Навигация', value: 'nav' },
        { label: 'Поддержка', value: 'support' },
      ],
      admin: {
        description: 'В какой колонке футера показывать страницу.',
        condition: (data) => Boolean(data?.showInFooter),
      },
    },
    {
      name: 'seo',
      type: 'group',
      label: 'SEO',
      fields: [
        { name: 'title', type: 'text', label: 'SEO-заголовок' },
        { name: 'description', type: 'textarea', label: 'SEO-описание' },
      ],
    },
  ],
  timestamps: true,
}
