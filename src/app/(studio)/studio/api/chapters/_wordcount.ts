/** Грубый счётчик слов из HTML тела главы: снимаем теги, считаем слова. */
export function wordCountFromHtml(html: string): number {
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return 0
  return text.split(' ').filter(Boolean).length
}
