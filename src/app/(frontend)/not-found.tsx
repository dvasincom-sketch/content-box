import Link from 'next/link'

/**
 * Брендовая страница 404. Рендерится внутри (frontend)/layout,
 * поэтому шапка, футер и тема применяются автоматически.
 */
export default function NotFound() {
  return (
    <main
      className="page-canvas"
      style={{
        minHeight: '68vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <section className="max-w-xl mx-auto px-4 py-20 text-center">
        <div
          aria-hidden
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: 'clamp(96px, 18vw, 180px)',
            lineHeight: 1,
            backgroundImage: 'linear-gradient(120deg, var(--brand-primary), var(--brand-accent))',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            letterSpacing: '-0.03em',
          }}
        >
          404
        </div>
        <h1
          className="mt-4 text-2xl lg:text-3xl font-extrabold"
          style={{ color: 'var(--brand-text)', fontFamily: 'var(--font-heading)' }}
        >
          Похоже, такой страницы нет
        </h1>
        <p className="mt-3 text-base" style={{ color: 'var(--brand-muted)' }}>
          Страница не найдена или её перенесли. Давайте вернёмся к контенту — на
          главной вас ждут свежие материалы проекта.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="c-btn c-btn--primary c-btn--pill">
            На главную
          </Link>
          <Link href="/search" className="c-btn c-btn--surface c-btn--pill">
            Поиск по сайту
          </Link>
        </div>
      </section>
    </main>
  )
}
