import Link from 'next/link'
import { ContentBoxLogo } from '@/components/ContentBoxLogo'

/**
 * Заглушка для нераспознанного домена (proxy.ts делает rewrite сюда).
 * Рендерится внутри (frontend)/layout без шапки/футера (тенант не определён),
 * тема — дефолтная. Оформлена в стиле платформы «Контент Бокс».
 */
export default function DomainNotFound() {
  return (
    <div
      style={{
        minHeight: '82vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 20px',
        color: 'var(--brand-text)',
      }}
    >
      <section style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            transform: 'scale(1.35)',
            transformOrigin: 'center',
            marginBottom: 34,
          }}
        >
          <ContentBoxLogo />
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: 'clamp(24px, 5vw, 34px)',
            letterSpacing: '-0.02em',
            margin: '0 0 12px',
          }}
        >
          Сайт ещё не подключён
        </h1>
        <p
          style={{
            color: 'var(--brand-muted)',
            lineHeight: 1.6,
            fontSize: 16,
            margin: '0 0 28px',
          }}
        >
          Этот домен пока не привязан к активному проекту на платформе «Контент Бокс».
          Если это ваш домен — активируйте проект и проверьте привязку домена в студии.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="https://contentbox.site"
            className="c-btn c-btn--primary c-btn--pill"
            style={{ textDecoration: 'none' }}
          >
            О платформе
          </a>
          <Link
            href="/studio"
            className="c-btn c-btn--surface c-btn--pill"
            style={{ textDecoration: 'none' }}
          >
            Войти в студию
          </Link>
        </div>
      </section>
    </div>
  )
}
