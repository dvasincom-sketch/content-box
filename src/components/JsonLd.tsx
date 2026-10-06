/**
 * Рендерит один или несколько блоков микроразметки Schema.org в виде
 * <script type="application/ld+json">. Серверный компонент — вставляется прямо
 * в разметку страницы. `<` экранируется, чтобы содержимое не могло «вырваться»
 * из тега script (XSS-safe).
 */
export function JsonLd({ data }: { data: unknown | unknown[] }) {
  const items = (Array.isArray(data) ? data : [data]).filter(Boolean)
  if (items.length === 0) return null
  return (
    <>
      {items.map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(d).replace(/</g, '\\u003c') }}
        />
      ))}
    </>
  )
}
