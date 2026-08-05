import type { CollectionConfig } from 'payload'
import { tenantScopedCollection } from '../access'
import { slugify } from '../lib/slugify'

/**
 * Books («Книги») — авторские текстовые произведения (книги, рассказы).
 * Контейнер: обложка, аннотация, статус, возрастной рейтинг, категория, теги,
 * гейтинг. Сами тексты — в главах (коллекция `chapters`, привязка book).
 *
 * Гейтинг книги: `minTier` (уровень для платных глав) + `freeChapters`
 * (сколько первых глав открыты всем). Глава также может быть помечена
 * бесплатной индивидуально (chapters.isPreview) или иметь свой minTier.
 *
 * `tenant` инжектит multi-tenant плагин.
 */
export const Books: CollectionConfig = {
  slug: 'books',
  labels: { singular: 'Книга', plural: 'Книги' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'category', 'minTier', 'updatedAt'],
    group: 'Контент',
    description: 'Авторские произведения (книги, рассказы) с главами.',
  },
  access: tenantScopedCollection,
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data && !data.slug && data.title) data.slug = slugify(String(data.title)) || undefined
        return data
      },
    ],
  },
  fields: [
    // `tenant` добавляет multi-tenant плагин.
    { name: 'title', type: 'text', required: true, label: 'Название' },
    {
      name: 'slug',
      type: 'text',
      label: 'Слаг (адрес)',
      admin: { description: 'Заполняется автоматически из названия; можно поправить.' },
    },
    {
      name: 'type',
      type: 'select',
      label: 'Тип произведения',
      defaultValue: 'novel',
      options: [
        { label: 'Роман', value: 'novel' },
        { label: 'Рассказ', value: 'story' },
        { label: 'Миниатюра', value: 'mini' },
        { label: 'Цикл', value: 'cycle' },
      ],
      admin: { description: 'Единая сущность: тип выбирается здесь, отдельных разделов нет.' },
    },
    {
      name: 'cycle',
      type: 'relationship',
      relationTo: 'books',
      label: 'Цикл',
      admin: { description: 'Привязать к циклу (произведению типа «Цикл»).' },
    },
    {
      name: 'cycleOrder',
      type: 'number',
      label: '№ в цикле',
      min: 0,
    },
    { name: 'cover', type: 'upload', relationTo: 'media', label: 'Обложка' },
    { name: 'annotation', type: 'richText', label: 'Аннотация' },
    {
      name: 'status',
      type: 'select',
      label: 'Статус',
      defaultValue: 'ongoing',
      options: [
        { label: 'В процессе', value: 'ongoing' },
        { label: 'Завершено', value: 'finished' },
        { label: 'Заморожено', value: 'frozen' },
      ],
    },
    {
      name: 'ageRating',
      type: 'select',
      label: 'Возрастной рейтинг',
      defaultValue: '16',
      options: [
        { label: '12+', value: '12' },
        { label: '16+', value: '16' },
        { label: '18+', value: '18' },
      ],
    },
    {
      name: 'allowComments',
      type: 'checkbox',
      defaultValue: true,
      label: 'Разрешить комментарии',
    },
    {
      name: 'allowDownload',
      type: 'checkbox',
      defaultValue: false,
      label: 'Разрешить скачивание',
    },
    { name: 'category', type: 'relationship', relationTo: 'categories', label: 'Категория' },
    {
      name: 'tags',
      type: 'array',
      label: 'Теги',
      admin: { description: 'Жанры, метки, пейринги — навигация по каталогу.' },
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'slug', type: 'text' },
      ],
    },
    {
      name: 'minTier',
      type: 'relationship',
      relationTo: 'subscription-tiers',
      label: 'Уровень подписки для платных глав',
      admin: { description: 'Пусто — вся книга бесплатна. Иначе платные главы требуют этот уровень и выше.' },
    },
    {
      name: 'freeChapters',
      type: 'number',
      label: 'Бесплатных глав в начале',
      defaultValue: 0,
      min: 0,
      admin: { description: 'Сколько первых глав открыты всем (0 — по флагу главы/подписке).' },
    },
    { name: 'genre1', type: 'text', label: 'Жанр 1' },
    { name: 'genre2', type: 'text', label: 'Жанр 2' },
    { name: 'quote1', type: 'textarea', label: 'Цитата 1', admin: { description: 'Видна читателям на странице книги.' } },
    { name: 'quote2', type: 'textarea', label: 'Цитата 2' },
    { name: 'quote3', type: 'textarea', label: 'Цитата 3' },
    { name: 'booktrailer', type: 'text', label: 'Буктрейлер (ссылка на видео)', admin: { description: 'YouTube, Rutube, VK, Дзен и др.' } },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Дата публикации',
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
  ],
  timestamps: true,
}
