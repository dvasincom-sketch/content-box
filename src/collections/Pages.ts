import type { CollectionConfig } from 'payload'
import { publicReadTenantWrite } from '../access'

/**
 * Pages (ТЗ §3.6) — groundwork for the future block builder. `blocks` is not
 * edited in the admin in Stage 1 (composition fixed in code), but the field
 * exists so migrating to admin-editable blocks is a move, not a rewrite.
 * `slug === 'home'` denotes the landing page.
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Page', plural: 'Pages' },
  admin: {
    useAsTitle: 'slug',
    description: 'Задел под блочный конструктор — на этапе 1 не редактируется.',
  },
  access: publicReadTenantWrite,
  fields: [
    // `tenant` added by the multi-tenant plugin.
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      defaultValue: 'home',
      admin: { description: '`home` для главной' },
    },
    {
      name: 'blocks',
      type: 'blocks',
      label: 'Блоки',
      admin: { description: 'Наполняется на следующем инкременте.' },
      // Real block schemas arrive with the block-builder increment.
      blocks: [],
    },
  ],
  timestamps: true,
}
