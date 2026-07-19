import type { MenuNode } from '@/lib/buildMenu'

export type FooterItem = { label: string; href: string }
export type FooterColumn = { heading: string; items: FooterItem[] }

/**
 * Адаптер: дерево футера (buildMenu('footer')) → структура для SiteFooter.
 *
 * Футер двухуровневый:
 *   - корневой узел С детьми  → колонка (heading = label, items = прямые дети);
 *   - корневой узел БЕЗ детей  → отдельная ссылка в общей колонке `nav`.
 * Вложенность глубже 2-го уровня в футере игнорируется (children.children
 * не разворачиваем — футер не место для глубоких деревьев).
 */
export function footerFromTree(tree: MenuNode[]): {
  nav: FooterItem[]
  columns: FooterColumn[]
} {
  const nav: FooterItem[] = []
  const columns: FooterColumn[] = []

  for (const root of tree) {
    if (root.children.length > 0) {
      columns.push({
        heading: root.title,
        items: root.children.map((c) => ({ label: c.title, href: c.href })),
      })
    } else {
      nav.push({ label: root.title, href: root.href })
    }
  }

  return { nav, columns }
}
