'use client'

import React, { useState } from 'react'
import Link from 'next/link'

export type FeaturedData = {
  pubCount: number
  subCount: number
  pubs: { title: string; coverUrl: string | null; dateLabel: string | null; slug: string | null }[]
}

/**
 * Витрина проектов (клиент). Шапка повторяет лендинг (единый стиль). Featured
 * BTS Russia показывает РЕАЛЬНУЮ ленту последних публикаций (из props.featured).
 * Витринные проекты — демо, закрыты. Темы — сетки (без горизонтальной прокрутки,
 * плашки не режутся). Тема наследуется с лендинга.
 */

// !!! Реальный сайт проекта. Поставить, когда подключим btsrussia.ru.
const BTS = {
  name: 'BTS Russia',
  topicLabel: 'Музыка · Фандом',
  tagline: 'Крупнейшее русскоязычное сообщество ARMY: эксклюзивы, переводы, разборы и живые эфиры.',
  siteUrl: 'https://bts.contentbox.site',
}

// Знак логотипа — точь-в-точь как в шапке лендинга (public/landing.html).
const LOGO_MARK = `<svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg"><g transform="translate(26 26)"><path d="M-16 -16 H16 V0 L0 16 H-16 Z" fill="currentColor" opacity="0.9"><animateTransform attributeName="transform" type="translate" values="0 0; -4 -4; 0 0" dur="3s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.4 0 0.2 1;0.4 0 0.2 1"/></path><path d="M16 -16 V16 H-16 L16 -16 Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><animateTransform attributeName="transform" type="translate" values="0 0; 4 4; 0 0" dur="3s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.4 0 0.2 1;0.4 0 0.2 1"/></path></g></svg>`

type TopicMeta = { value: string; label: string }
const TOPICS: TopicMeta[] = [
  { value: 'podcasts', label: 'Подкасты и шоу' },
  { value: 'visual_arts', label: 'Визуальное искусство' },
  { value: 'tabletop', label: 'Настольные игры' },
  { value: 'video_games', label: 'Видеоигры' },
  { value: 'music', label: 'Музыка' },
  { value: 'lifestyle', label: 'Лайфстайл' },
  { value: 'writing', label: 'Тексты' },
  { value: 'handicrafts', label: 'Рукоделие' },
  { value: 'apps', label: 'Приложения и софт' },
  { value: 'social', label: 'Социальные проекты' },
]
const TOPIC_LABEL: Record<string, string> = Object.fromEntries(TOPICS.map((t) => [t.value, t.label]))
const CHIPS = [{ value: 'all', label: 'Все' }, { value: 'new', label: 'Новое' }, ...TOPICS]

const GRAD: Record<string, string> = {
  podcasts: 'linear-gradient(135deg,#6366f1,#4338ca)',
  visual_arts: 'linear-gradient(135deg,#f59e0b,#ef4444)',
  tabletop: 'linear-gradient(135deg,#14b8a6,#0891b2)',
  video_games: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
  music: 'linear-gradient(135deg,#ec4899,#8b5cf6)',
  lifestyle: 'linear-gradient(135deg,#10b981,#059669)',
  writing: 'linear-gradient(135deg,#3b82f6,#1e40af)',
  handicrafts: 'linear-gradient(135deg,#f43f5e,#be185d)',
  apps: 'linear-gradient(135deg,#06b6d4,#2563eb)',
  social: 'linear-gradient(135deg,#22c55e,#0d9488)',
}

function TopicIcon({ t, className }: { t: string; className?: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<string, React.ReactNode> = {
    podcasts: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" /></>,
    visual_arts: <><circle cx="13.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="10.5" r="1.5" /><circle cx="8.5" cy="7.5" r="1.5" /><circle cx="6.5" cy="12.5" r="1.5" /><path d="M12 2a10 10 0 1 0 0 20c1.7 0 2-1.3 1-2.3-1-1-1-2.7.5-3.2 3-1 5.5-1.5 5.5-4.5A10 10 0 0 0 12 2Z" /></>,
    tabletop: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1" /><circle cx="15.5" cy="8.5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="8.5" cy="15.5" r="1" /><circle cx="15.5" cy="15.5" r="1" /></>,
    video_games: <><rect x="2" y="7" width="20" height="10" rx="5" /><path d="M7 11v2M6 12h2M15.5 11.5h.01M18 13.5h.01" /></>,
    music: <><path d="M9 18V6l10-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></>,
    lifestyle: <><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10Z" /></>,
    writing: <><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    handicrafts: <><path d="M4 8h16M6 8l1.5 11a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8L18 8M9 8V5a3 3 0 0 1 6 0v3" /></>,
    apps: <><path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12" /></>,
    social: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.5M18.5 20a5.5 5.5 0 0 0-3-4.9" /></>,
  }
  return <svg viewBox="0 0 24 24" className={className} aria-hidden {...common}>{paths[t] || <circle cx="12" cy="12" r="9" />}</svg>
}

type Project = { name: string; topic: string; tagline: string; isNew?: boolean }
const RAW: Project[] = [
  { name: 'Ночной эфир', topic: 'podcasts', tagline: 'Разговоры до рассвета: гости, музыка, звонки в студию.' },
  { name: 'Две кружки', topic: 'podcasts', tagline: 'О кино и сериалах без спойлеров… почти.', isNew: true },
  { name: 'Тихий час', topic: 'podcasts', tagline: 'Медленные беседы о книгах и внутренней тишине.' },
  { name: 'На частоте', topic: 'podcasts', tagline: 'Интервью с музыкантами и звук изнутри.' },
  { name: 'Тушь и свет', topic: 'visual_arts', tagline: 'Иллюстрация, скетчбук и разборы процесса.' },
  { name: 'Мастерская Лины', topic: 'visual_arts', tagline: 'Цифровой арт, кисти и таймлапсы.' },
  { name: 'Раскадровка', topic: 'visual_arts', tagline: 'Сторибординг и концепт для анимации.', isNew: true },
  { name: 'Цвет и форма', topic: 'visual_arts', tagline: 'Живопись и композиция для начинающих.' },
  { name: 'Кубик раздора', topic: 'tabletop', tagline: 'Настолки, D&D-кампании и печатные материалы.' },
  { name: 'Гильдия за столом', topic: 'tabletop', tagline: 'Обзоры новинок и сценарии для своих игр.' },
  { name: 'Инициатива', topic: 'tabletop', tagline: 'Мастеринг и подземелья своими руками.' },
  { name: 'Меепл', topic: 'tabletop', tagline: 'Евро-стратегии и разборы партий.', isNew: true },
  { name: 'Пиксельный подвал', topic: 'video_games', tagline: 'Инди и ретро: находки, гайды, стримы.' },
  { name: 'Спидран-клуб', topic: 'video_games', tagline: 'Прохождения на время и разбор трюков.' },
  { name: 'Босс на минималках', topic: 'video_games', tagline: 'Сложные игры без урона — гайды и заезды.' },
  { name: 'Сейв-поинт', topic: 'video_games', tagline: 'Уютные разборы сюжетов и концовок.' },
  { name: 'Гараж 47', topic: 'music', tagline: 'Лоу-фай, синты и записи из домашней студии.' },
  { name: 'Полутон', topic: 'music', tagline: 'Электроника и эмбиент, пресеты и семплы.' },
  { name: 'Бетон', topic: 'music', tagline: 'Индустриальная электроника и лайв-сеты.', isNew: true },
  { name: 'Тёплый ламповый', topic: 'music', tagline: 'Гитары, аналог и разбор аранжировок.' },
  { name: 'Медленное утро', topic: 'lifestyle', tagline: 'Быт, осознанность и уют без спешки.' },
  { name: 'Дом на колёсах', topic: 'lifestyle', tagline: 'Тревел и ван-лайф: маршруты и лайфхаки.' },
  { name: 'Городской сад', topic: 'lifestyle', tagline: 'Растения на балконе и городская зелень.' },
  { name: 'Минимум вещей', topic: 'lifestyle', tagline: 'Осознанное потребление и порядок.', isNew: true },
  { name: 'Черновик', topic: 'writing', tagline: 'Проза с продолжением — глава за главой.' },
  { name: 'Между строк', topic: 'writing', tagline: 'Эссе, заметки и письма подписчикам.' },
  { name: 'Первое лицо', topic: 'writing', tagline: 'Автофикшн и дневниковая проза.' },
  { name: 'Сюжетный крючок', topic: 'writing', tagline: 'Сценарное мастерство и структура истории.', isNew: true },
  { name: 'Петля и нить', topic: 'handicrafts', tagline: 'Вязание и схемы: от простого к сложному.' },
  { name: 'Глина и руки', topic: 'handicrafts', tagline: 'Керамика, гончарный круг и обжиг.' },
  { name: 'Дерево и стамеска', topic: 'handicrafts', tagline: 'Резьба и мелкая столярка дома.' },
  { name: 'Бумажный сад', topic: 'handicrafts', tagline: 'Оригами, скрапбукинг и открытки.' },
  { name: 'Кодовый ужин', topic: 'apps', tagline: 'Разбор пет-проектов и код-ревью вживую.' },
  { name: 'Софт по выходным', topic: 'apps', tagline: 'Маленькие приложения и их исходники.', isNew: true },
  { name: 'Пет-проект', topic: 'apps', tagline: 'От идеи до релиза за подписку.' },
  { name: 'Тёмная тема', topic: 'apps', tagline: 'Дизайн интерфейсов и фронтенд-приёмы.' },
  { name: 'Тёплый круг', topic: 'social', tagline: 'Волонтёрство и взаимопомощь по-соседски.' },
  { name: 'Зелёный двор', topic: 'social', tagline: 'Экоинициативы и городские посадки.' },
  { name: 'Рука помощи', topic: 'social', tagline: 'Сбор и поддержка тех, кому трудно.' },
  { name: 'Соседи', topic: 'social', tagline: 'Локальные сообщества и добрые дела.', isNew: true },
]

function initials(name: string): string {
  const w = name.replace(/[«»"]/g, '').trim().split(/\s+/)
  return ((w[0]?.[0] || '') + (w[1]?.[0] || '')).toUpperCase()
}
function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K'
  return String(n)
}

function LockBadge() {
  return (
    <span className="ex__lock" title="Готовится к запуску">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      Скоро
    </span>
  )
}

function ProjectCard({ p, i }: { p: Project; i: number }) {
  return (
    <article className="ex__card" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }} title="Готовится к запуску">
      <div className="ex__card-cover" style={{ background: GRAD[p.topic] }}>
        <TopicIcon t={p.topic} className="ex__card-wm" />
        <span className="ex__card-shine" />
        <LockBadge />
        {p.isNew && <span className="ex__tag-new">Новое</span>}
        <span className="ex__avatar" aria-hidden>{initials(p.name)}</span>
      </div>
      <div className="ex__card-body">
        <div className="ex__card-topic"><TopicIcon t={p.topic} className="ex__card-topic-ic" />{TOPIC_LABEL[p.topic]}</div>
        <h3 className="ex__card-name">{p.name}</h3>
        <p className="ex__card-tag">{p.tagline}</p>
      </div>
    </article>
  )
}

function toggleTheme() {
  try {
    const cur = document.documentElement.classList.contains('theme-light') ? 'light' : 'dark'
    const next = cur === 'light' ? 'dark' : 'light'
    document.documentElement.classList.remove('theme-light', 'theme-dark')
    document.documentElement.classList.add('theme-' + next)
    document.documentElement.style.colorScheme = next
    localStorage.setItem('theme', next)
  } catch {
    /* no-op */
  }
}

function ThemeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4" />
    </svg>
  )
}

export function ExploreView({ featured }: { featured: FeaturedData | null }) {
  const [topic, setTopic] = useState('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const showFeatured = topic === 'all' || topic === 'music'
  const sections = topic === 'all' ? TOPICS : TOPICS.filter((t) => t.value === topic)
  const newList = topic === 'new' ? RAW.filter((p) => p.isNew) : []
  const pubs = featured?.pubs ?? []

  return (
    <div className="explore">
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{EXPLORE_CSS}</style>

      {/* Шапка — сквозная, как на лендинге (на мобиле: только знак + бургер) */}
      <header className="ex__hdr">
        <div className="ex-wrap ex__nav">
          <Link href="/" className="ex__logo">
            <span className="ex__logo-mark" aria-hidden dangerouslySetInnerHTML={{ __html: LOGO_MARK }} />
            Контент&nbsp;<span className="ex__logo-mono">Бокс</span>
          </Link>
          <nav className="ex__nav-links">
            <Link href="/explore">Проекты</Link>
            <a href="/#studio-shots">Студия</a>
            <a href="/#pricing">Цена</a>
            <a href="/#fears">Вопросы</a>
          </nav>
          <div className="ex__nav-right">
            <button
              className={`ex__burger ${menuOpen ? 'is-open' : ''}`}
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Меню"
              aria-expanded={menuOpen}
            >
              <span /><span /><span />
            </button>
            <button className="ex__theme" type="button" onClick={toggleTheme} aria-label="Сменить тему" title="Сменить тему">
              <ThemeIcon />
            </button>
            <Link href="/studio" className="btn btn--ghost">Войти в студию</Link>
            <Link href="/signup" className="btn btn--primary">Создать проект</Link>
          </div>
        </div>
        <div className={`ex__mmenu ${menuOpen ? 'is-open' : ''}`}>
          <Link href="/explore" onClick={() => setMenuOpen(false)}>Проекты</Link>
          <a href="/#studio-shots" onClick={() => setMenuOpen(false)}>Студия</a>
          <a href="/#pricing" onClick={() => setMenuOpen(false)}>Цена</a>
          <a href="/#fears" onClick={() => setMenuOpen(false)}>Вопросы</a>
          <button className="ex__theme-wide" type="button" onClick={toggleTheme}>
            <ThemeIcon /> Сменить тему
          </button>
          <Link href="/signup" className="btn btn--primary" onClick={() => setMenuOpen(false)}>Создать проект</Link>
        </div>
      </header>

      <div className="ex__hero">
        <span className="ex__hero-glow" aria-hidden />
        <div className="ex-wrap ex__hero-inner">
          <div className="ex__eyebrow">Витрина площадки</div>
          <h1 className="ex__title">Проекты авторов</h1>
          <p className="ex__lede">
            Смотрите, как авторы, контент-мейкеры и инфлюэнсеры запускают сообщества на Контент Боксе.
            Один проект уже в эфире, десятки — на старте.
          </p>
          <div className="ex__stats">
            <div className="ex__stat"><b>1</b><span>действующий</span></div>
            <div className="ex__stat"><b>{RAW.length}</b><span>готовятся</span></div>
            <div className="ex__stat"><b>{TOPICS.length}</b><span>тем</span></div>
          </div>
        </div>
      </div>

      <main className="ex-wrap ex__main">
        <div className="ex__chips" role="tablist" aria-label="Темы">
          {CHIPS.map((t) => (
            <button key={t.value} type="button" className={`ex__chip ${topic === t.value ? 'is-active' : ''}`} onClick={() => setTopic(t.value)} role="tab" aria-selected={topic === t.value}>
              {t.label}
            </button>
          ))}
        </div>

        {showFeatured && (
          <section className="ex__featured" aria-label="Действующий проект">
            <div className="ex__featured-cover" style={{ background: GRAD.music }}>
              <span className="ex__featured-blob" aria-hidden />
              <TopicIcon t="music" className="ex__featured-wm" />
              <span className="ex__badge ex__badge--live">● В эфире</span>
              <div className="ex__featured-avatar">
                BTS
                <span className="ex__verified" title="Проверенный проект" aria-label="Проверено">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="m9 16.2-3.5-3.5 1.4-1.4L9 13.4l7.1-7.1 1.4 1.4z" /></svg>
                </span>
              </div>
            </div>
            <div className="ex__featured-body">
              <div className="ex__featured-topic">{BTS.topicLabel}</div>
              <h2 className="ex__featured-name">{BTS.name}</h2>
              <p className="ex__featured-tag">{BTS.tagline}</p>
              {featured && (
                <div className="ex__featured-stats">
                  <div className="ex__fstat"><b>{formatCount(featured.subCount)}</b><span>подписчиков</span></div>
                  <div className="ex__fstat"><b>{formatCount(featured.pubCount)}</b><span>публикаций</span></div>
                  <div className="ex__fstat"><b>с 2024</b><span>на площадке</span></div>
                </div>
              )}

              {pubs.length > 0 && (
                <div className="ex__feed">
                  <div className="ex__feed-head">Последние публикации</div>
                  <div className="ex__feed-strip">
                    {pubs.map((p, i) => (
                      <a
                        key={i}
                        href={p.slug ? `${BTS.siteUrl}/publication/${p.slug}` : BTS.siteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ex__feed-card"
                      >
                        <span
                          className="ex__feed-thumb"
                          style={p.coverUrl ? { backgroundImage: `url(${p.coverUrl})` } : { background: GRAD.music }}
                        >
                          {!p.coverUrl && <TopicIcon t="music" className="ex__feed-wm" />}
                        </span>
                        {p.dateLabel && <span className="ex__feed-meta">{p.dateLabel}</span>}
                        <span className="ex__feed-title">{p.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="ex__featured-actions">
                <a href={BTS.siteUrl} target="_blank" rel="noopener noreferrer" className="btn btn--primary">Перейти на сайт →</a>
                <a href={BTS.siteUrl} target="_blank" rel="noopener noreferrer" className="btn btn--ghost">Все публикации</a>
              </div>
            </div>
          </section>
        )}

        {topic === 'new' ? (
          <section className="ex__sec">
            <div className="ex__sec-head"><h2>Новое</h2><span className="ex__count">{newList.length}</span></div>
            {newList.length === 0 ? (
              <div className="ex__empty">Пока нет новых проектов. Загляните позже.</div>
            ) : (
              <div className="ex__grid">{newList.map((p, i) => <ProjectCard key={p.name} p={p} i={i} />)}</div>
            )}
          </section>
        ) : (
          <>
            {topic === 'all' && (
              <div className="ex__soon-head">
                <h2>Готовятся к запуску</h2>
                <p>Эти проекты скоро откроются на площадке. Загляните позже — или займите нишу первыми.</p>
              </div>
            )}
            {sections.map((t) => {
              const items = RAW.filter((p) => p.topic === t.value)
              return (
                <section className="ex__sec" key={t.value}>
                  <div className="ex__sec-head">
                    <h2><TopicIcon t={t.value} className="ex__sec-ic" />{t.label}</h2>
                    <span className="ex__count">{items.length}</span>
                  </div>
                  <div className="ex__grid">
                    {items.map((p, i) => <ProjectCard key={p.name} p={p} i={i} />)}
                  </div>
                </section>
              )
            })}
          </>
        )}

        <div className="ex__cta">
          <h2 className="ex__cta-title">Хотите свой такой проект?</h2>
          <p className="ex__cta-lede">Запустите сайт подписок за пару минут — настройка бренда займёт ещё несколько.</p>
          <Link href="/signup" className="btn btn--primary btn--lg">Создать проект</Link>
        </div>
      </main>
    </div>
  )
}

const EXPLORE_CSS = `
.explore {
  --sans:'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
  --mono:'IBM Plex Mono', ui-monospace, Menlo, monospace;
  min-height:100vh; background:var(--bg); color:var(--text); font-family:var(--sans); -webkit-font-smoothing:antialiased;
}
.theme-dark .explore, .explore {
  --bg:#0a0a0b; --surface:#131316; --surface-2:#1a1a1e; --surface-hover:#202027;
  --border:#26262c; --border-strong:#35353d;
  --text:#f4f4f5; --muted:#a1a1aa; --faint:#6b6b74;
  --accent:#ffffff; --accent-text:#0a0a0b; --accent-hover:#e4e4e7; --live:#4ade80;
  --card-shadow:0 1px 2px rgba(0,0,0,.4), 0 18px 40px rgba(0,0,0,.35);
}
.theme-light .explore {
  --bg:#f7f7f8; --surface:#ffffff; --surface-2:#f4f4f5; --surface-hover:#ececed;
  --border:#e6e6e9; --border-strong:#d4d4d8;
  --text:#18181b; --muted:#52525b; --faint:#a1a1aa;
  --accent:#18181b; --accent-text:#ffffff; --accent-hover:#27272a; --live:#16a34a;
  --card-shadow:0 1px 2px rgba(24,24,27,.05), 0 16px 34px rgba(24,24,27,.08);
}
.ex-wrap { max-width:1080px; margin:0 auto; padding:0 24px; }
/* Шапка — как на лендинге: высота 64, sticky, backdrop, логотип-знак + кнопки */
.ex__hdr { position:sticky; top:0; z-index:50; background:color-mix(in srgb, var(--bg) 82%, transparent); backdrop-filter:blur(12px); border-bottom:1px solid var(--border); }
.ex__nav { display:flex; align-items:center; justify-content:space-between; height:64px; }
.ex__logo { display:flex; align-items:center; gap:10px; font-weight:600; font-size:16px; letter-spacing:-.01em; color:var(--text); text-decoration:none; }
.ex__logo-mark { width:32px; height:32px; border-radius:8px; background:var(--surface-2); color:var(--text); border:1px solid var(--border); display:grid; place-items:center; }
.ex__logo-mark svg { width:21px; height:21px; display:block; }
.ex__logo-mono { font-family:var(--mono); font-weight:500; }
.ex__nav-links { display:flex; gap:28px; font-family:var(--mono); font-size:13px; color:var(--muted); }
.ex__nav-links a { color:var(--muted); text-decoration:none; transition:color .14s ease; }
.ex__nav-links a:hover { color:var(--text); }
.ex__nav-right { display:flex; align-items:center; gap:14px; }
.ex__theme { width:34px; height:34px; border:1px solid var(--border); border-radius:6px; background:transparent; color:var(--muted); cursor:pointer; display:grid; place-items:center; transition:background .14s ease, color .14s ease; }
.ex__theme:hover { background:var(--surface-hover); color:var(--text); }
/* Бургер + мобильное меню — как на лендинге (скрыты на десктопе) */
.ex__burger { display:none; width:38px; height:38px; border:1px solid var(--border); border-radius:6px; background:transparent; cursor:pointer; flex-direction:column; gap:4px; align-items:center; justify-content:center; }
.ex__burger span { width:16px; height:2px; background:var(--text); border-radius:2px; transition:transform .2s ease, opacity .2s ease; }
.ex__burger.is-open span:nth-child(1){ transform:translateY(6px) rotate(45deg); }
.ex__burger.is-open span:nth-child(2){ opacity:0; }
.ex__burger.is-open span:nth-child(3){ transform:translateY(-6px) rotate(-45deg); }
.ex__mmenu { display:none; flex-direction:column; gap:14px; padding:16px 24px 22px; border-bottom:1px solid var(--border); background:color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter:blur(12px); }
.ex__mmenu.is-open { display:flex; }
.ex__mmenu > a { font-family:var(--mono); font-size:15px; color:var(--muted); text-decoration:none; }
.ex__mmenu > a:hover { color:var(--text); }
.ex__theme-wide { display:inline-flex; align-items:center; gap:8px; align-self:flex-start; height:36px; padding:0 14px; border:1px solid var(--border); border-radius:6px; background:transparent; color:var(--muted); cursor:pointer; font-family:var(--sans); font-size:14px; }
.ex__theme-wide:hover { color:var(--text); background:var(--surface-hover); }
.btn { display:inline-flex; align-items:center; gap:8px; padding:10px 18px; border-radius:6px; font-family:var(--sans); font-weight:550; font-size:14px; cursor:pointer; border:1px solid transparent; text-decoration:none; transition:background .14s ease, border-color .14s ease; white-space:nowrap; }
.btn--primary { background:var(--accent); color:var(--accent-text); }
.btn--primary:hover { background:var(--accent-hover); }
.btn--ghost { background:transparent; color:var(--text); border-color:var(--border); }
.btn--ghost:hover { background:var(--surface-hover); }
.btn--lg { padding:13px 24px; font-size:15px; }
/* Hero */
.ex__hero { position:relative; overflow:hidden; border-bottom:1px solid var(--border); }
.ex__hero-glow { position:absolute; inset:-40% -10% auto -10%; height:420px; pointer-events:none; opacity:.6; background:radial-gradient(45% 60% at 25% 20%, rgba(124,58,237,.35), transparent 70%), radial-gradient(40% 55% at 80% 10%, rgba(236,72,153,.28), transparent 70%), radial-gradient(45% 60% at 60% 90%, rgba(56,189,248,.22), transparent 70%); filter:blur(30px); animation:ex-float 14s ease-in-out infinite alternate; }
.ex__hero-inner { position:relative; padding-top:52px; padding-bottom:38px; }
.ex__eyebrow { font-family:var(--mono); font-size:12px; letter-spacing:.16em; color:var(--muted); margin-bottom:14px; }
.ex__title { font-size:clamp(30px,4.6vw,48px); font-weight:700; letter-spacing:-.03em; margin:0 0 14px; }
.ex__lede { font-size:17px; color:var(--muted); line-height:1.55; max-width:620px; margin:0 0 26px; }
.ex__stats { display:flex; gap:14px; flex-wrap:wrap; }
.ex__stat { display:flex; flex-direction:column; padding:12px 18px; background:var(--surface); border:1px solid var(--border); border-radius:12px; min-width:110px; }
.ex__stat b { font-size:24px; font-weight:700; letter-spacing:-.02em; }
.ex__stat span { font-family:var(--mono); font-size:12px; color:var(--faint); margin-top:2px; }
.ex__main { padding-top:26px; padding-bottom:80px; }
/* Chips */
.ex__chips { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:30px; }
.ex__chip { padding:8px 14px; font-size:13.5px; cursor:pointer; color:var(--muted); background:var(--surface); border:1px solid var(--border); border-radius:999px; transition:color .15s, background .15s, border-color .15s, transform .1s; white-space:nowrap; }
.ex__chip:hover { color:var(--text); background:var(--surface-hover); }
.ex__chip:active { transform:scale(.96); }
.ex__chip.is-active { color:var(--accent-text); background:var(--accent); border-color:var(--accent); }
/* Featured */
.ex__featured { display:grid; grid-template-columns:minmax(280px, 420px) 1fr; margin-bottom:44px; background:var(--surface); border:1px solid var(--border-strong); border-radius:20px; overflow:hidden; box-shadow:var(--card-shadow); animation:ex-rise .5s cubic-bezier(.4,0,.2,1) both; }
.ex__featured-cover { position:relative; min-height:300px; overflow:hidden; }
.ex__featured-blob { position:absolute; inset:0; background:radial-gradient(60% 60% at 30% 20%, rgba(255,255,255,.25), transparent 60%), radial-gradient(50% 50% at 90% 80%, rgba(0,0,0,.25), transparent 60%); animation:ex-float 10s ease-in-out infinite alternate; }
.ex__featured-wm { position:absolute; right:-20px; bottom:-20px; width:200px; height:200px; color:rgba(255,255,255,.16); }
.ex__featured-avatar { position:absolute; left:26px; bottom:26px; width:104px; height:104px; border-radius:26px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:32px; color:#fff; background:rgba(0,0,0,.35); border:2px solid rgba(255,255,255,.7); backdrop-filter:blur(4px); }
.ex__verified { position:absolute; right:-6px; bottom:-6px; width:26px; height:26px; border-radius:50%; background:var(--live); color:#062; display:flex; align-items:center; justify-content:center; border:2px solid var(--surface); }
.ex__badge { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px; font-family:var(--mono); font-size:11.5px; font-weight:500; }
.ex__badge--live { position:absolute; top:18px; right:18px; left:auto; background:rgba(0,0,0,.42); color:#fff; }
.ex__featured-body { padding:26px 30px; display:flex; flex-direction:column; }
.ex__featured-topic { font-family:var(--mono); font-size:12px; color:var(--muted); letter-spacing:.08em; margin-bottom:8px; }
.ex__featured-name { font-size:30px; font-weight:700; letter-spacing:-.02em; margin:0 0 8px; }
.ex__featured-tag { font-size:15px; color:var(--muted); line-height:1.5; margin:0 0 16px; }
.ex__featured-stats { display:flex; gap:26px; padding-bottom:18px; margin-bottom:18px; border-bottom:1px solid var(--border); }
.ex__fstat b { font-size:19px; font-weight:700; }
.ex__fstat span { display:block; font-family:var(--mono); font-size:11.5px; color:var(--faint); margin-top:2px; }
.ex__feed { margin-bottom:18px; }
.ex__feed-head { font-family:var(--mono); font-size:12px; color:var(--muted); margin-bottom:12px; letter-spacing:.06em; }
.ex__feed-strip { display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; }
.ex__feed-card { display:flex; flex-direction:column; gap:8px; text-decoration:none; color:var(--text); }
.ex__feed-thumb { position:relative; display:block; aspect-ratio:16/10; border-radius:10px; background-color:var(--surface-2); background-size:cover; background-position:center; border:1px solid var(--border); overflow:hidden; color:rgba(255,255,255,.4); transition:transform .15s ease; }
.ex__feed-card:hover .ex__feed-thumb { transform:translateY(-2px); }
.ex__feed-wm { position:absolute; right:-6px; bottom:-8px; width:52px; height:52px; }
.ex__feed-meta { font-family:var(--mono); font-size:11px; color:var(--faint); }
.ex__feed-title { font-size:13px; line-height:1.35; font-weight:500; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.ex__featured-actions { display:flex; gap:10px; margin-top:auto; flex-wrap:wrap; }
/* Секции по темам (сетки — без прокрутки, плашки не режутся) */
.ex__soon-head { margin-bottom:6px; }
.ex__soon-head h2 { font-size:22px; font-weight:600; letter-spacing:-.02em; margin:0 0 4px; }
.ex__soon-head p { color:var(--muted); font-size:14px; margin:0; }
.ex__sec { margin-top:28px; }
.ex__sec-head { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
.ex__sec-head h2 { display:flex; align-items:center; gap:9px; font-size:16px; font-weight:600; margin:0; letter-spacing:-.01em; }
.ex__sec-ic { width:17px; height:17px; color:var(--muted); }
.ex__count { font-family:var(--mono); font-size:12px; color:var(--faint); }
.ex__grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:16px; }
/* Card */
.ex__card { background:var(--surface); border:1px solid var(--border); border-radius:15px; overflow:hidden; display:flex; flex-direction:column; height:100%; animation:ex-rise .45s cubic-bezier(.4,0,.2,1) both; transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
.ex__card:hover { transform:translateY(-4px); box-shadow:var(--card-shadow); border-color:var(--border-strong); }
.ex__card-cover { position:relative; height:112px; overflow:hidden; }
.ex__card-wm { position:absolute; right:-14px; top:-14px; width:96px; height:96px; color:rgba(255,255,255,.18); }
.ex__card-shine { position:absolute; inset:0; background:linear-gradient(115deg, transparent 30%, rgba(255,255,255,.25) 50%, transparent 70%); transform:translateX(-120%); transition:transform .6s ease; }
.ex__card:hover .ex__card-shine { transform:translateX(120%); }
.ex__lock { position:absolute; top:10px; left:10px; display:inline-flex; align-items:center; gap:5px; padding:4px 9px; border-radius:999px; background:rgba(0,0,0,.4); color:#fff; font-family:var(--mono); font-size:10.5px; }
.ex__tag-new { position:absolute; top:10px; right:10px; padding:4px 9px; border-radius:999px; background:rgba(0,0,0,.45); color:#fff; font-family:var(--mono); font-size:10.5px; }
.ex__avatar { position:absolute; left:14px; bottom:-16px; width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:15px; color:#fff; background:rgba(0,0,0,.4); border:2px solid var(--surface); backdrop-filter:blur(3px); }
.ex__card-body { padding:22px 15px 15px; display:flex; flex-direction:column; gap:5px; flex:1; }
.ex__card-topic { display:flex; align-items:center; gap:5px; font-family:var(--mono); font-size:10.5px; color:var(--faint); letter-spacing:.04em; }
.ex__card-topic-ic { width:12px; height:12px; }
.ex__card-name { font-size:16px; font-weight:600; margin:0; letter-spacing:-.01em; }
.ex__card-tag { font-size:13px; color:var(--muted); line-height:1.45; margin:0; }
.ex__empty { color:var(--muted); font-size:15px; padding:30px 0; }
/* CTA */
.ex__cta { margin-top:60px; text-align:center; padding:44px 20px; border-top:1px solid var(--border); }
.ex__cta-title { font-size:26px; font-weight:600; letter-spacing:-.02em; margin:0 0 8px; }
.ex__cta-lede { font-size:15px; color:var(--muted); margin:0 0 22px; }
/* Motion */
@keyframes ex-rise { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
@keyframes ex-float { from { transform:translate(0,0) scale(1); } to { transform:translate(2%, -3%) scale(1.05); } }
@media (prefers-reduced-motion: reduce) {
  .ex__card, .ex__featured, .ex__hero-glow, .ex__featured-blob { animation:none !important; }
  .ex__card-shine { display:none; }
}
@media (max-width:820px){
  /* Мобильная шапка как на лендинге: только знак лого + бургер */
  .ex__nav-links { display:none; }
  .ex__burger { display:flex; }
  .ex__theme { display:none; }
  .ex__nav-right .btn--primary { display:none; }
  .ex__logo { font-size:0; gap:0; }
  .ex__featured { grid-template-columns:1fr; }
  .ex__featured-cover { min-height:180px; }
  .ex__feed-strip { grid-template-columns:repeat(2, 1fr); }
}
@media (max-width:400px){
  .ex__nav-right .btn--ghost { display:none; }
}
`
