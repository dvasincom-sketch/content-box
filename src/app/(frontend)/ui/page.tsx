import React from 'react'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { UIShowcaseExtra } from '@/components/UIShowcaseExtra'

/**
 * Витрина UI-компонентов (/ui) — styleguide на реальных брендовых токенах.
 *
 * Показывает цвета, кнопки, поля, карточки, бейджи и типографику в текущей
 * теме тенанта. Публичная страница. Переключение темы (шапкой) меняет
 * bg/surface/text — видно, как компоненты адаптируются.
 *
 * Брендовые переменные:
 *  --brand-primary, --brand-accent      (из brandVars, задаются тенантом)
 *  --brand-bg, --brand-surface, --brand-text  (из .theme-dark/.theme-light)
 */
export default async function UIPage() {
  const ctx = await getTenantFromHeaders()
  const settings = ctx?.settings as any

  const soft = (pct: number) =>
    `color-mix(in srgb, var(--brand-text) ${pct}%, transparent)`
  const surfaceSoft = (pct: number) =>
    `color-mix(in srgb, var(--brand-surface) ${pct}%, transparent)`

  const sectionStyle: React.CSSProperties = {
    marginBottom: 48,
  }
  const headingStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    opacity: 0.6,
    marginBottom: 16,
    color: 'var(--brand-text)',
  }
  const card: React.CSSProperties = {
    background: surfaceSoft(45),
    border: `1px solid ${soft(10)}`,
    borderRadius: 12,
    padding: 20,
  }
  const swatch = (label: string, value: string): React.ReactNode => (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          height: 72,
          borderRadius: 10,
          background: value,
          border: `1px solid ${soft(12)}`,
          marginBottom: 8,
        }}
      />
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--brand-text)' }}>{label}</div>
      <div style={{ fontSize: 11, opacity: 0.5, color: 'var(--brand-text)' }}>{value}</div>
    </div>
  )

  return (
    <main
      style={{
        ...brandVars(settings?.theme, settings?.typography),
        background: 'var(--brand-bg)',
        color: 'var(--brand-text)',
        minHeight: '100vh',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8, color: 'var(--brand-text)' }}>
          UI-компоненты
        </h1>
        <p style={{ opacity: 0.6, marginBottom: 48, color: 'var(--brand-text)' }}>
          Витрина элементов на брендовых токенах. Переключите тему в шапке —
          компоненты адаптируются.
        </p>

        {/* ЦВЕТА */}
        <section style={sectionStyle}>
          <div style={headingStyle}>Цвета</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 16,
            }}
          >
            {swatch('Primary', 'var(--brand-primary)')}
            {swatch('Accent', 'var(--brand-accent)')}
            {swatch('Background', 'var(--brand-bg)')}
            {swatch('Surface', 'var(--brand-surface)')}
            {swatch('Text', 'var(--brand-text)')}
          </div>
        </section>

        {/* КНОПКИ */}
        <section style={sectionStyle}>
          <div style={headingStyle}>Кнопки</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <button
              style={{
                padding: '11px 22px',
                fontSize: 15,
                fontWeight: 600,
                color: '#fff',
                background: 'var(--brand-primary)',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              Основная
            </button>
            <button
              style={{
                padding: '11px 22px',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--brand-text)',
                background: 'transparent',
                border: `1px solid ${soft(25)}`,
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              Вторичная
            </button>
            <button
              style={{
                padding: '11px 22px',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--brand-primary)',
                background: `color-mix(in srgb, var(--brand-primary) 14%, transparent)`,
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              Мягкая
            </button>
            <button
              style={{
                padding: '11px 22px',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--brand-text)',
                background: 'transparent',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                opacity: 0.7,
              }}
            >
              Текстовая
            </button>
            <button
              style={{
                padding: '8px 18px',
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
                background: 'var(--brand-primary)',
                border: 'none',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              Пилюля
            </button>
          </div>
        </section>

        {/* ПОЛЯ */}
        <section style={sectionStyle}>
          <div style={headingStyle}>Поля ввода</div>
          <div style={{ display: 'grid', gap: 14, maxWidth: 420 }}>
            <input
              placeholder="Обычное поле"
              style={{
                padding: '11px 14px',
                fontSize: 15,
                color: 'var(--brand-text)',
                background: surfaceSoft(50),
                border: `1px solid ${soft(20)}`,
                borderRadius: 10,
              }}
            />
            <input
              placeholder="С фокус-рамкой (акцент)"
              style={{
                padding: '11px 14px',
                fontSize: 15,
                color: 'var(--brand-text)',
                background: surfaceSoft(50),
                border: `2px solid var(--brand-primary)`,
                borderRadius: 10,
              }}
            />
            <textarea
              placeholder="Многострочное поле"
              rows={3}
              style={{
                padding: '11px 14px',
                fontSize: 15,
                color: 'var(--brand-text)',
                background: surfaceSoft(50),
                border: `1px solid ${soft(20)}`,
                borderRadius: 10,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </section>

        {/* КАРТОЧКИ */}
        <section style={sectionStyle}>
          <div style={headingStyle}>Карточки</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            <div style={card}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Обычная карточка</div>
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                Поверхность на брендовом surface с мягкой рамкой.
              </div>
            </div>
            <div style={{ ...card, border: `2px solid var(--brand-primary)` }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Акцентная</div>
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                Рамка фирменным фиолетовым — для выделенного.
              </div>
            </div>
          </div>
        </section>

        {/* БЕЙДЖИ */}
        <section style={sectionStyle}>
          <div style={headingStyle}>Бейджи</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <span
              style={{
                padding: '4px 12px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 999,
                color: '#fff',
                background: 'var(--brand-primary)',
              }}
            >
              Primary
            </span>
            <span
              style={{
                padding: '4px 12px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 999,
                color: '#fff',
                background: 'var(--brand-accent)',
              }}
            >
              Accent
            </span>
            <span
              style={{
                padding: '4px 12px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 999,
                color: 'var(--brand-primary)',
                background: `color-mix(in srgb, var(--brand-primary) 14%, transparent)`,
              }}
            >
              Мягкий
            </span>
            <span
              style={{
                padding: '4px 12px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 999,
                color: 'var(--brand-text)',
                background: surfaceSoft(60),
                border: `1px solid ${soft(15)}`,
              }}
            >
              Нейтральный
            </span>
          </div>
        </section>

        {/* ТИПОГРАФИКА */}
        <section style={sectionStyle}>
          <div style={headingStyle}>Типографика</div>
          <div style={card}>
            <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>Заголовок H1</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Заголовок H2</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Заголовок H3</div>
            <p style={{ fontSize: 16, lineHeight: 1.7, opacity: 0.85, marginBottom: 8 }}>
              Основной текст. Быстрая коричневая лиса прыгает через ленивого пса.
              Проверка кириллицы и латиницы в брендовом шрифте.
            </p>
            <p style={{ fontSize: 14, opacity: 0.6 }}>
              Вторичный текст — подписи, подсказки, метаданные.
            </p>
          </div>
        </section>

        <UIShowcaseExtra />
      </div>
    </main>
  )
}
