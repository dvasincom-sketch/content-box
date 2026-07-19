import type { CollectionConfig } from 'payload'
import { publicReadTenantWrite } from '../access'

/**
 * MenuItems — слой ручных оверрайдов поверх автогенерации меню из категорий.
 *
 * Модель «ленивой материализации»: меню по умолчанию строится из Categories
 * (см. lib/headerMenu). Запись в этой коллекции появляется ТОЛЬКО когда узел
 * тронут в конструкторе — скрыт, переупорядочен, переименован, или это
 * вручную добавленный пункт (страница / URL). Сборщик меню сливает автоген
 * с этими оверрайдами по полю `category`.
 *
 * Две независимые структуры: header и footer (поле `location`).
 * Вложенность до 4 уровней через self-reference `parent` (глубина режется
 * в сборщике, не схемой).
 */
export const MenuItems: CollectionConfig = {
  slug: 'menu-items',
  labels: { singular: 'Пункт меню', plural: 'Пункты меню' },
  admin: {
    useAsTitle: 'labelOverride',
    defaultColumns: ['labelOverride', 'location', 'kind', 'order', 'hidden'],
    description: 'Ручные правки меню поверх автогенерации из категорий.',
  },
  access: publicReadTenantWrite,
  fields: [
    // `tenant` добавляется плагином multi-tenant.
    {
      type: 'row',
      fields: [
        {
          name: 'location',
          type: 'select',
          required: true,
          defaultValue: 'header',
          label: 'Где',
          options: [
            { label: 'Шапка (меню)', value: 'header' },
            { label: 'Футер', value: 'footer' },
          ],
          admin: { width: '50%' },
        },
        {
          name: 'kind',
          type: 'select',
          required: true,
          defaultValue: 'category',
          label: 'Тип пункта',
          options: [
            { label: 'Категория', value: 'category' },
            { label: 'Страница', value: 'page' },
            { label: 'Внешняя ссылка', value: 'url' },
          ],
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      label: 'Категория',
      admin: {
        description: 'Оверрайд авто-узла категории.',
        condition: (data) => data?.kind === 'category',
      },
    },
    {
      name: 'page',
      type: 'relationship',
      relationTo: 'pages',
      label: 'Страница',
      admin: {
        description: 'Пункт ведёт на страницу («О проекте» и т.п.).',
        condition: (data) => data?.kind === 'page',
      },
    },
    {
      name: 'url',
      type: 'text',
      label: 'Внешний URL',
      admin: {
        description: 'Абсолютная ссылка: https://…',
        condition: (data) => data?.kind === 'url',
      },
    },
    {
      name: 'labelOverride',
      type: 'text',
      label: 'Название в меню',
      admin: {
        description: 'Пусто — берётся имя категории/страницы. Для URL обязательно.',
      },
    },
    {
      name: 'hidden',
      type: 'checkbox',
      label: 'Скрыт',
      defaultValue: false,
      admin: { description: 'Скрыть узел из меню, не удаляя запись.' },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'menu-items',
      label: 'Родитель',
      admin: {
        description: 'Пункт-родитель для вложенности. Пусто — корневой уровень.',
      },
    },
    {
      name: 'order',
      type: 'number',
      label: 'Порядок',
      defaultValue: 0,
      admin: { description: 'Сортировка внутри своего уровня.' },
    },
  ],
  timestamps: true,
}
