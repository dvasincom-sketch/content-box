import type { Where } from 'payload'

/**
 * Условие «публикация действительно опубликована» для ПУБЛИЧНЫХ выборок.
 *
 * Модель у публикаций такая: отдельного `_status`/drafts нет, черновик — это
 * `publishedAt = null` (см. studio/api/create-post и update-post). Значит любая
 * публичная выборка обязана этот фильтр ставить, иначе черновики попадают на
 * сайт. Хуже того, PostgreSQL при `sort: '-publishedAt'` по умолчанию даёт
 * NULLS FIRST — черновики встают В НАЧАЛО ленты.
 *
 * `less_than_equal: now` закрывает сразу два случая: пустую дату (черновик) и
 * дату в будущем (отложенная публикация). Такой же вид условия уже стоял
 * в /explore — здесь оно вынесено в одно место, чтобы его снова не забыли.
 *
 * ВАЖНО: к `videos` это НЕ применяется — студия при создании видео
 * `publishedAt` не заполняет вовсе, так что для видео поле необязательное и
 * фильтр по нему скрыл бы всю видеотеку.
 */
export function publishedWhere(nowISO?: string): Where {
  return { publishedAt: { less_than_equal: nowISO ?? new Date().toISOString() } }
}

/** Опубликована ли конкретная публикация (для проверки одного документа). */
export function isPublished(pub: { publishedAt?: string | null } | null | undefined): boolean {
  if (!pub?.publishedAt) return false
  return new Date(pub.publishedAt).getTime() <= Date.now()
}
