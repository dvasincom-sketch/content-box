import NextLink from 'next/link'
import type { ComponentProps } from 'react'

/**
 * Обёртка над next/link с prefetch={false} по умолчанию.
 *
 * App Router по умолчанию префетчит все Link в вьюпорте/при наведении. На
 * страницах со списками (карточки публикаций, постеры, меню, футер) это даёт
 * бёрст тяжёлых RSC-рендеров разом (каждый рендер категории/публикации — 6–10
 * запросов к БД), исчерпывает пул Postgres и роняет контейнер. Ссылки остаются
 * рабочими: навигация по клику префетчит по требованию. Явный prefetch в пропсах
 * переопределяет дефолт.
 */
export default function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />
}
