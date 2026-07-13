'use client'

import React, { useState } from 'react'

/**
 * Расширенные (в т.ч. интерактивные) блоки витрины UI.
 * Клиентский компонент — табы, тосты, toggle пароля, переключатели требуют
 * состояния. Встраивается в серверную страницу /ui.
 *
 * Все цвета — брендовые токены (--brand-primary, --brand-accent,
 * --brand-surface, --brand-text). Работает в обеих темах.
 */

const soft = (pct: number) => `color-mix(in srgb, var(--brand-text) ${pct}%, transparent)`
const surfaceSoft = (pct: number) => `color-mix(in srgb, var(--brand-surface) ${pct}%, transparent)`
const primarySoft = (pct: number) => `color-mix(in srgb, var(--brand-primary) ${pct}%, transparent)`

const sectionStyle: React.CSSProperties = { marginBottom: 48 }
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

export function UIShowcaseExtra() {
  const [tab, setTab] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)
  const [checked, setChecked] = useState(true)
  const [radio, setRadio] = useState('a')
  const [toggle, setToggle] = useState(true)
  const [page, setPage] = useState(2)

  function fireToast() {
    setToast('Подписка успешно оформлена')
    setTimeout(() => setToast(null), 2500)
  }

  const tiers = [
    { name: 'РАМЁН', price: 490, features: ['Ранний доступ', 'Без рекламы'], accent: false },
    { name: 'СОДЖУ', price: 630, features: ['Всё из РАМЁН', 'Переводы Weverse', 'Эксклюзивы'], accent: true },
    { name: 'САМГЁПСАЛЬ', price: 1380, features: ['Всё из СОДЖУ', 'Концерты в HD', 'Закрытый чат'], accent: false },
  ]

  return (
    <>
      {/* ТАРИФЫ */}
      <section style={sectionStyle}>
        <div style={headingStyle}>Карточки тарифов</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {tiers.map((t) => (
            <div
              key={t.name}
              style={{
                ...card,
                border: t.accent ? `2px solid var(--brand-primary)` : `1px solid ${soft(10)}`,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {t.accent && (
                <span
                  style={{
                    position: 'absolute',
                    top: -10,
                    left: 20,
                    padding: '2px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 999,
                    color: '#fff',
                    background: 'var(--brand-primary)',
                  }}
                >
                  ПОПУЛЯРНЫЙ
                </span>
              )}
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4, color: 'var(--brand-text)' }}>{t.name}</div>
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--brand-text)' }}>{t.price}₽</span>
                <span style={{ fontSize: 14, opacity: 0.5, color: 'var(--brand-text)' }}> / мес</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', flex: 1 }}>
                {t.features.map((f) => (
                  <li key={f} style={{ fontSize: 14, opacity: 0.8, marginBottom: 6, color: 'var(--brand-text)' }}>
                    ✓ {f}
                  </li>
                ))}
              </ul>
              <button
                style={{
                  padding: '10px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: 'none',
                  color: t.accent ? '#fff' : 'var(--brand-primary)',
                  background: t.accent ? 'var(--brand-primary)' : primarySoft(14),
                }}
              >
                Оформить
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* КАРТОЧКА ВИДЕО + ГЕЙТ */}
      <section style={sectionStyle}>
        <div style={headingStyle}>Карточки видео</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {/* Открытое */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ height: 120, background: primarySoft(20), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 32, opacity: 0.4 }}>▶</span>
            </div>
            <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, color: 'var(--brand-primary)', background: primarySoft(14) }}>Бесплатно</span>
                <span style={{ fontSize: 11, opacity: 0.5, alignSelf: 'center', color: 'var(--brand-text)' }}>12:34</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--brand-text)' }}>Weverse Live · перевод</div>
            </div>
          </div>
          {/* Закрытое (гейт) */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ height: 120, background: soft(8), display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, marginBottom: 4 }}>🔒</div>
                <div style={{ fontSize: 12, opacity: 0.6, color: 'var(--brand-text)' }}>По подписке</div>
              </div>
            </div>
            <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, color: '#fff', background: 'var(--brand-accent)' }}>СОДЖУ</span>
                <span style={{ fontSize: 11, opacity: 0.5, alignSelf: 'center', color: 'var(--brand-text)' }}>48:10</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--brand-text)' }}>Концерт · озвучка</div>
            </div>
          </div>
        </div>
      </section>

      {/* АЛЕРТЫ */}
      <section style={sectionStyle}>
        <div style={headingStyle}>Уведомления</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {[
            { c: '#16a34a', bg: 'rgba(22,163,74,0.12)', t: 'Подписка оформлена. Доступ открыт.' },
            { c: '#dc2626', bg: 'rgba(220,38,38,0.12)', t: 'Не удалось провести оплату. Попробуйте другой способ.' },
            { c: '#2563eb', bg: 'rgba(37,99,235,0.12)', t: 'Новое видео в разделе «Концерты».' },
            { c: '#d97706', bg: 'rgba(217,119,6,0.12)', t: 'Подписка истекает через 3 дня.' },
          ].map((a, i) => (
            <div key={i} style={{ padding: '12px 16px', borderRadius: 10, background: a.bg, borderLeft: `3px solid ${a.c}`, fontSize: 14, color: 'var(--brand-text)' }}>
              {a.t}
            </div>
          ))}
        </div>
      </section>

      {/* ЗАГРУЗКА / СКЕЛЕТОНЫ */}
      <section style={sectionStyle}>
        <div style={headingStyle}>Загрузка</div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 28, height: 28, border: `3px solid ${soft(15)}`, borderTopColor: 'var(--brand-primary)', borderRadius: '50%', animation: 'ui-spin 0.8s linear infinite' }} />
          <div style={{ flex: 1, minWidth: 200, display: 'grid', gap: 8 }}>
            <div style={{ height: 12, borderRadius: 6, background: soft(10), width: '80%' }} />
            <div style={{ height: 12, borderRadius: 6, background: soft(10), width: '60%' }} />
            <div style={{ height: 12, borderRadius: 6, background: soft(10), width: '70%' }} />
          </div>
        </div>
        <style>{`@keyframes ui-spin { to { transform: rotate(360deg) } }`}</style>
      </section>

      {/* ПУСТЫЕ СОСТОЯНИЯ */}
      <section style={sectionStyle}>
        <div style={headingStyle}>Пустые состояния</div>
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>📭</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6, color: 'var(--brand-text)' }}>Пока нет видео</div>
          <div style={{ fontSize: 14, opacity: 0.6, marginBottom: 16, color: 'var(--brand-text)' }}>Новые переводы появятся здесь.</div>
          <button style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, color: '#fff', background: 'var(--brand-primary)', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
            Оформить подписку
          </button>
        </div>
      </section>

      {/* ТОСТ */}
      <section style={sectionStyle}>
        <div style={headingStyle}>Тост (всплывающее)</div>
        <button onClick={fireToast} style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, color: 'var(--brand-primary)', background: primarySoft(14), border: 'none', borderRadius: 10, cursor: 'pointer' }}>
          Показать тост
        </button>
        {toast && (
          <div style={{ marginTop: 14, display: 'inline-block', padding: '12px 18px', borderRadius: 10, background: 'var(--brand-primary)', color: '#fff', fontSize: 14, fontWeight: 500 }}>
            ✓ {toast}
          </div>
        )}
      </section>

      {/* ТАБЫ */}
      <section style={sectionStyle}>
        <div style={headingStyle}>Табы</div>
        <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${soft(12)}`, marginBottom: 16 }}>
          {['Обзор', 'Видео', 'Отзывы'].map((label, i) => (
            <button
              key={label}
              onClick={() => setTab(i)}
              style={{
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 600,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: tab === i ? 'var(--brand-primary)' : 'var(--brand-text)',
                opacity: tab === i ? 1 : 0.6,
                borderBottom: tab === i ? `2px solid var(--brand-primary)` : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 14, opacity: 0.75, color: 'var(--brand-text)' }}>
          Содержимое вкладки «{['Обзор', 'Видео', 'Отзывы'][tab]}».
        </div>
      </section>

      {/* ПЕРЕКЛЮЧАТЕЛИ */}
      <section style={sectionStyle}>
        <div style={headingStyle}>Переключатели</div>
        <div style={{ ...card, display: 'grid', gap: 16, maxWidth: 420 }}>
          {/* Checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--brand-text)' }}>
            <span
              onClick={() => setChecked((v) => !v)}
              style={{
                width: 20, height: 20, borderRadius: 5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: checked ? 'var(--brand-primary)' : 'transparent',
                border: checked ? 'none' : `1px solid ${soft(30)}`,
                color: '#fff', fontSize: 13,
              }}
            >
              {checked ? '✓' : ''}
            </span>
            Чекбокс
          </label>
          {/* Radio */}
          <div style={{ display: 'flex', gap: 16 }}>
            {['a', 'b'].map((r) => (
              <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--brand-text)' }} onClick={() => setRadio(r)}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${radio === r ? 'var(--brand-primary)' : soft(30)}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {radio === r && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-primary)' }} />}
                </span>
                Вариант {r.toUpperCase()}
              </label>
            ))}
          </div>
          {/* Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--brand-text)' }} onClick={() => setToggle((v) => !v)}>
            <span style={{ width: 40, height: 22, borderRadius: 999, background: toggle ? 'var(--brand-primary)' : soft(20), position: 'relative', transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: 2, left: toggle ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </span>
            Переключатель
          </label>
        </div>
      </section>

      {/* СЕЛЕКТ + ПОЛЕ ПАРОЛЯ + ОШИБКА */}
      <section style={sectionStyle}>
        <div style={headingStyle}>Поля (расширенные)</div>
        <div style={{ display: 'grid', gap: 14, maxWidth: 420 }}>
          <select style={{ padding: '11px 14px', fontSize: 15, color: 'var(--brand-text)', background: surfaceSoft(50), border: `1px solid ${soft(20)}`, borderRadius: 10 }}>
            <option>Выберите участника</option>
            <option>RM</option>
            <option>Jin</option>
            <option>SUGA</option>
          </select>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              defaultValue="secret123"
              style={{ width: '100%', padding: '11px 44px 11px 14px', fontSize: 15, color: 'var(--brand-text)', background: surfaceSoft(50), border: `1px solid ${soft(20)}`, borderRadius: 10, boxSizing: 'border-box' }}
            />
            <button onClick={() => setShowPass((v) => !v)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--brand-primary)' }}>
              {showPass ? 'скрыть' : 'показать'}
            </button>
          </div>
          <div>
            <input placeholder="Поле с ошибкой" style={{ width: '100%', padding: '11px 14px', fontSize: 15, color: 'var(--brand-text)', background: surfaceSoft(50), border: `2px solid #dc2626`, borderRadius: 10, boxSizing: 'border-box' }} />
            <div style={{ fontSize: 13, color: '#dc2626', marginTop: 6 }}>Это поле обязательно.</div>
          </div>
        </div>
      </section>

      {/* МЕТРИКИ */}
      <section style={sectionStyle}>
        <div style={headingStyle}>Метрики</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {[
            { label: 'Подписчиков', value: '15 868' },
            { label: 'Выручка / мес', value: '₽ 312k' },
            { label: 'Видео', value: '631' },
            { label: 'Отток', value: '2.4%' },
          ].map((m) => (
            <div key={m.label} style={{ background: surfaceSoft(45), borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 4, color: 'var(--brand-text)' }}>{m.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand-text)' }}>{m.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ПРОГРЕСС */}
      <section style={sectionStyle}>
        <div style={headingStyle}>Прогресс</div>
        <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
          {[30, 65, 90].map((p) => (
            <div key={p}>
              <div style={{ height: 8, borderRadius: 999, background: soft(12), overflow: 'hidden' }}>
                <div style={{ width: `${p}%`, height: '100%', background: 'var(--brand-primary)' }} />
              </div>
              <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4, color: 'var(--brand-text)' }}>{p}%</div>
            </div>
          ))}
        </div>
      </section>

      {/* ПАГИНАЦИЯ */}
      <section style={sectionStyle}>
        <div style={headingStyle}>Пагинация</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3, 4, 5].map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                width: 38, height: 38, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                border: page === p ? 'none' : `1px solid ${soft(15)}`,
                background: page === p ? 'var(--brand-primary)' : 'transparent',
                color: page === p ? '#fff' : 'var(--brand-text)',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      {/* ТАБЛИЦА */}
      <section style={sectionStyle}>
        <div style={headingStyle}>Таблица</div>
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${soft(12)}`, textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', color: 'var(--brand-text)' }}>Подписчик</th>
                <th style={{ padding: '12px 16px', color: 'var(--brand-text)' }}>Уровень</th>
                <th style={{ padding: '12px 16px', color: 'var(--brand-text)' }}>До</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Дмитрий', 'СОДЖУ', '12.08'],
                ['Анна', 'РАМЁН', '03.09'],
                ['Игорь', 'САМГЁПСАЛЬ', '21.07'],
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: i < 2 ? `1px solid ${soft(8)}` : 'none' }}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ padding: '12px 16px', opacity: j === 0 ? 1 : 0.75, color: 'var(--brand-text)' }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
