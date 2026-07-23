'use client'

import React, { useRef, useState } from 'react'
import Link from 'next/link'

/**
 * Витрина проектов (/explore) — аналог patreon.com/explore, без поиска: только
 * фильтр темами (чипсы). Полный редизайн: hero, «живой» featured-блок
 * действующего проекта BTS Russia (крупно), ряды-карусели по темам, карточки с
 * аватарами и значком темы, каскадное появление и ховер-отклик.
 *
 * Проекты (кроме BTS Russia) — витринные, ГОТОВЯТСЯ к запуску (на замке). Честно:
 * фейковой активности (посты/цены) не показываем — «жизнь» даём дизайном.
 *
 * BTS Russia — реальный действующий проект. Адрес его сайта — BTS.siteUrl.
 * Тема (свет/тьма) наследуется с лендинга.
 */

// !!! Реальный сайт проекта. Поставить, когда подключим btsrussia.ru.
const BTS = {
  name: 'BTS Russia',
  topicLabel: 'Музыка · Фандом',
  tagline: 'Крупнейшее русскоязычное сообщество ARMY: эксклюзивы, переводы, разборы и живые эфиры.',
  siteUrl: 'https://bts.contentbox.site',
  stats: [
    { v: '48.2K', k: 'подписчиков' },
    { v: '320', k: 'публикаций' },
    { v: 'с 2024', k: 'на площадке' },
  ],
  publications: [
    { title: 'Разбор нового клипа: кадр за кадром', tag: 'Видео', date: '2 дня назад', grad: 'music' },
    { title: 'Перевод интервью для Weverse Magazine', tag: 'Текст', date: '5 дней назад', grad: 'writing' },
    { title: 'Живой эфир: обсуждаем комбэк', tag: 'Эфир', date: 'на прошлой неделе', grad: 'podcasts' },
    { title: 'Фотоотчёт со встречи фан-клуба', tag: 'Галерея', date: '2 недели назад', grad: 'visual_arts' },
  ],
}

type TopicMeta = { value: string; label: string; grad: string }

const TOPICS: TopicMeta[] = [
  { value: 'podcasts', label: 'Подкасты и шоу', grad: 'podcasts' },
  { value: 'visual_arts', label: 'Визуальное искусство', grad: 'visual_arts' },
  { value: 'tabletop', label: 'Настольные игры', grad: 'tabletop' },
  { value: 'video_games', label: 'Видеоигры', grad: 'video_games' },
  { value: 'music', label: 'Музыка', grad: 'music' },
  { value: 'lifestyle', label: 'Лайфстайл', grad: 'lifestyle' },
  { value: 'writing', label: 'Тексты', grad: 'writing' },
  { value: 'handicrafts', label: 'Рукоделие', grad: 'handicrafts' },
  { value: 'apps', label: 'Приложения и софт', grad: 'apps' },
  { value: 'social', label: 'Социальные проекты', grad: 'social' },
]
const TOPIC_LABEL: Record<string, string> = Object.fromEntries(TOPICS.map((t) => [t.value, t.label]))

const CHIPS = [{ value: 'all', label: 'Все' }, { value: 'new', label: 'Новое' }, ...TOPICS]

// Градиенты по темам (семейство цвета на тему — визуально связнее random).
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

// Компактные значки тем (обводка), рисуются водяным знаком на обложке.
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
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...common}>
      {paths[t] || <circle cx="12" cy="12" r="9" />}
    </svg>
  )
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

function LockBadge() {
  return (
    <span className="ex__lock" title="Готовится к запуску">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      Скоро
    </span>
  )
}

function ProjectCard({ p, i }: { p: Project; i: number }) {
  return (
    <article className="ex__card" style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }} title="Готовится к запуску">
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

function Row({ topic }: { topic: TopicMeta }) {
  const ref = useRef<HTMLDivElement>(null)
  const items = RAW.filter((p) => p.topic === topic.value)
  const scroll = (dir: number) => {
    ref.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })
  }
  return (
    <section className="ex__row">
      <div className="ex__row-head">
        <h2 className="ex__row-title"><TopicIcon t={topic.value} className="ex__row-ic" />{topic.label}</h2>
        <div className="ex__row-arrows">
          <button type="button" onClick={() => scroll(-1)} aria-label="Назад" className="ex__arrow">‹</button>
          <button type="button" onClick={() => scroll(1)} aria-label="Вперёд" className="ex__arrow">›</button>
        </div>
      </div>
      <div className="ex__scroller" ref={ref}>
        {items.map((p, i) => (
          <div className="ex__scroll-item" key={p.name}>
            <ProjectCard p={p} i={i} />
          </div>
        ))}
      </div>
    </section>
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

export default function ExplorePage() {
  const [topic, setTopic] = useState('all')

  const gridList =
    topic === 'new' ? RAW.filter((p) => p.isNew) : topic !== 'all' ? RAW.filter((p) => p.topic === topic) : []
  const showFeatured = topic === 'all' || topic === 'music'

  return (
    <div className="explore">
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{EXPLORE_CSS}</style>

      <header className="ex__top">
        <Link href="/" className="ex__logo">Контент <span className="ex__logo-mono">Бокс</span></Link>
        <div className="ex__top-right">
          <button className="ex__icon-btn" type="button" onClick={toggleTheme} aria-label="Сменить тему" title="Сменить тему">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4" />
            </svg>
          </button>
          <Link href="/studio" className="ex__btn ex__btn--ghost">Войти</Link>
          <Link href="/signup" className="ex__btn ex__btn--primary">Создать проект</Link>
        </div>
      </header>

      <div className="ex__hero">
        <span className="ex__hero-glow" aria-hidden />
        <div className="ex__hero-inner">
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

      <main className="ex__main">
        <div className="ex__chips" role="tablist" aria-label="Темы">
          {CHIPS.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`ex__chip ${topic === t.value ? 'is-active' : ''}`}
              onClick={() => setTopic(t.value)}
              role="tab"
              aria-selected={topic === t.value}
            >
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
              <div className="ex__featured-stats">
                {BTS.stats.map((s) => (
                  <div key={s.k} className="ex__fstat"><b>{s.v}</b><span>{s.k}</span></div>
                ))}
              </div>

              <div className="ex__feed">
                <div className="ex__feed-head">Лента публикаций</div>
                <div className="ex__feed-strip">
                  {BTS.publications.map((p, i) => (
                    <a key={i} href={BTS.siteUrl} target="_blank" rel="noopener noreferrer" className="ex__feed-card">
                      <span className="ex__feed-thumb" style={{ background: GRAD[p.grad] }}>
                        <TopicIcon t={p.grad} className="ex__feed-wm" />
                      </span>
                      <span className="ex__feed-tag">{p.tag} · {p.date}</span>
                      <span className="ex__feed-title">{p.title}</span>
                    </a>
                  ))}
                </div>
              </div>

              <div className="ex__featured-actions">
                <a href={BTS.siteUrl} target="_blank" rel="noopener noreferrer" className="ex__btn ex__btn--primary">Перейти на сайт →</a>
                <a href={BTS.siteUrl} target="_blank" rel="noopener noreferrer" className="ex__btn ex__btn--ghost">Все публикации</a>
              </div>
            </div>
          </section>
        )}

        {topic === 'all' ? (
          <>
            <div className="ex__soon-head">
              <h2>Готовятся к запуску</h2>
              <p>Эти проекты скоро откроются на площадке. Загляните позже — или займите нишу первыми.</p>
            </div>
            {TOPICS.map((t) => <Row key={t.value} topic={t} />)}
          </>
        ) : (
          <>
            <div className="ex__grid-head">
              {topic === 'new' ? 'Новое' : TOPIC_LABEL[topic]}
              <span className="ex__count">{gridList.length}</span>
            </div>
            {gridList.length === 0 ? (
              <div className="ex__empty">В этой теме пока нет проектов. Загляните позже.</div>
            ) : (
              <div className="ex__grid">
                {gridList.map((p, i) => <ProjectCard key={p.name} p={p} i={i} />)}
              </div>
            )}
          </>
        )}

        <div className="ex__cta">
          <h2 className="ex__cta-title">Хотите свой такой проект?</h2>
          <p className="ex__cta-lede">Запустите сайт подписок за пару минут — настройка бренда займёт ещё несколько.</p>
          <Link href="/signup" className="ex__btn ex__btn--primary ex__btn--lg">Создать проект</Link>
        </div>
      </main>
    </div>
  )
}

const EXPLORE_CSS = `
.explore {
  --sans:'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
  --mono:'IBM Plex Mono', ui-monospace, Menlo, monospace;
  min-height:100vh; background:var(--bg); color:var(--text); font-family:var(--sans);
  -webkit-font-smoothing:antialiased;
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
.ex__top {
  position:sticky; top:0; z-index:20; display:flex; align-items:center; justify-content:space-between;
  gap:16px; padding:13px max(20px, calc((100vw - 1160px)/2 + 20px));
  background:color-mix(in srgb, var(--bg) 82%, transparent); backdrop-filter:blur(14px);
  border-bottom:1px solid var(--border);
}
.ex__logo { font-weight:600; font-size:18px; color:var(--text); text-decoration:none; letter-spacing:-.01em; }
.ex__logo-mono { font-family:var(--mono); color:var(--muted); font-weight:500; }
.ex__top-right { display:flex; align-items:center; gap:10px; }
.ex__icon-btn { display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; color:var(--text); background:transparent; border:1px solid var(--border); border-radius:9px; cursor:pointer; }
.ex__icon-btn:hover { background:var(--surface-hover); }
.ex__btn {
  display:inline-flex; align-items:center; gap:8px; padding:9px 16px; font-size:14px; font-weight:600;
  border-radius:10px; text-decoration:none; cursor:pointer; border:1px solid transparent; font-family:var(--sans);
  transition:transform .15s ease, background .15s ease, border-color .15s ease; white-space:nowrap;
}
.ex__btn:active { transform:translateY(1px); }
.ex__btn--primary { background:var(--accent); color:var(--accent-text); }
.ex__btn--primary:hover { background:var(--accent-hover); }
.ex__btn--ghost { background:transparent; color:var(--text); border-color:var(--border); }
.ex__btn--ghost:hover { background:var(--surface-hover); }
.ex__btn--lg { padding:13px 24px; font-size:15px; }
/* Hero */
.ex__hero { position:relative; overflow:hidden; border-bottom:1px solid var(--border); }
.ex__hero-glow {
  position:absolute; inset:-40% -10% auto -10%; height:420px; pointer-events:none; opacity:.6;
  background:radial-gradient(45% 60% at 25% 20%, rgba(124,58,237,.35), transparent 70%),
            radial-gradient(40% 55% at 80% 10%, rgba(236,72,153,.28), transparent 70%),
            radial-gradient(45% 60% at 60% 90%, rgba(56,189,248,.22), transparent 70%);
  filter:blur(30px); animation:ex-float 14s ease-in-out infinite alternate;
}
.ex__hero-inner { position:relative; max-width:1160px; margin:0 auto; padding:56px max(20px, calc((100vw - 1160px)/2 + 20px)) 40px; }
.ex__eyebrow { font-family:var(--mono); font-size:12px; letter-spacing:.16em; color:var(--muted); margin-bottom:14px; }
.ex__title { font-size:clamp(32px,5vw,52px); font-weight:700; letter-spacing:-.03em; margin:0 0 14px; }
.ex__lede { font-size:17px; color:var(--muted); line-height:1.55; max-width:620px; margin:0 0 26px; }
.ex__stats { display:flex; gap:14px; flex-wrap:wrap; }
.ex__stat { display:flex; flex-direction:column; padding:12px 18px; background:var(--surface); border:1px solid var(--border); border-radius:12px; min-width:110px; }
.ex__stat b { font-size:24px; font-weight:700; letter-spacing:-.02em; }
.ex__stat span { font-family:var(--mono); font-size:12px; color:var(--faint); margin-top:2px; }
.ex__main { max-width:1160px; margin:0 auto; padding:26px max(20px, calc((100vw - 1160px)/2 + 20px)) 80px; }
/* Chips */
.ex__chips { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:30px; position:sticky; top:63px; z-index:9; padding:12px 0; background:color-mix(in srgb, var(--bg) 90%, transparent); }
.ex__chip { padding:8px 14px; font-size:13.5px; font-family:var(--sans); cursor:pointer; color:var(--muted); background:var(--surface); border:1px solid var(--border); border-radius:999px; transition:color .15s, background .15s, border-color .15s, transform .1s; white-space:nowrap; }
.ex__chip:hover { color:var(--text); background:var(--surface-hover); }
.ex__chip:active { transform:scale(.96); }
.ex__chip.is-active { color:var(--accent-text); background:var(--accent); border-color:var(--accent); }
/* Featured */
.ex__featured { display:grid; grid-template-columns:minmax(280px, 430px) 1fr; margin-bottom:44px; background:var(--surface); border:1px solid var(--border-strong); border-radius:20px; overflow:hidden; box-shadow:var(--card-shadow); animation:ex-rise .5s var(--e, cubic-bezier(.4,0,.2,1)) both; }
.ex__featured-cover { position:relative; min-height:300px; overflow:hidden; }
.ex__featured-blob { position:absolute; inset:0; background:radial-gradient(60% 60% at 30% 20%, rgba(255,255,255,.25), transparent 60%), radial-gradient(50% 50% at 90% 80%, rgba(0,0,0,.25), transparent 60%); animation:ex-float 10s ease-in-out infinite alternate; }
.ex__featured-wm { position:absolute; right:-20px; bottom:-20px; width:200px; height:200px; color:rgba(255,255,255,.16); }
.ex__featured-avatar { position:absolute; left:26px; bottom:26px; width:104px; height:104px; border-radius:26px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:32px; color:#fff; background:rgba(0,0,0,.35); border:2px solid rgba(255,255,255,.7); backdrop-filter:blur(4px); }
.ex__verified { position:absolute; right:-6px; bottom:-6px; width:26px; height:26px; border-radius:50%; background:var(--live); color:#062; display:flex; align-items:center; justify-content:center; border:2px solid var(--surface); }
.ex__badge { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px; font-family:var(--mono); font-size:11.5px; font-weight:500; }
.ex__badge--live { position:absolute; top:18px; left:18px; background:rgba(0,0,0,.42); color:#fff; }
.ex__badge--live::before { display:none; }
.ex__featured-body { padding:26px 30px; display:flex; flex-direction:column; }
.ex__featured-topic { font-family:var(--mono); font-size:12px; color:var(--muted); letter-spacing:.08em; margin-bottom:8px; }
.ex__featured-name { font-size:30px; font-weight:700; letter-spacing:-.02em; margin:0 0 8px; }
.ex__featured-tag { font-size:15px; color:var(--muted); line-height:1.5; margin:0 0 16px; }
.ex__featured-stats { display:flex; gap:26px; padding-bottom:18px; margin-bottom:18px; border-bottom:1px solid var(--border); }
.ex__fstat b { font-size:19px; font-weight:700; }
.ex__fstat span { display:block; font-family:var(--mono); font-size:11.5px; color:var(--faint); margin-top:2px; }
.ex__feed-head { font-family:var(--mono); font-size:12px; color:var(--muted); margin-bottom:12px; letter-spacing:.06em; }
.ex__feed-strip { display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; }
.ex__feed-card { display:flex; flex-direction:column; gap:7px; text-decoration:none; color:var(--text); background:var(--surface-2); border:1px solid var(--border); border-radius:11px; padding:8px; transition:transform .15s ease, border-color .15s ease; }
.ex__feed-card:hover { border-color:var(--border-strong); transform:translateY(-2px); }
.ex__feed-thumb { position:relative; overflow:hidden; height:60px; border-radius:8px; color:rgba(255,255,255,.35); }
.ex__feed-wm { position:absolute; right:-6px; bottom:-8px; width:52px; height:52px; }
.ex__feed-tag { font-family:var(--mono); font-size:10px; color:var(--faint); }
.ex__feed-title { font-size:12.5px; line-height:1.35; }
.ex__featured-actions { display:flex; gap:10px; margin-top:20px; flex-wrap:wrap; }
/* Soon heading */
.ex__soon-head { margin-bottom:8px; }
.ex__soon-head h2 { font-size:22px; font-weight:600; letter-spacing:-.02em; margin:0 0 4px; }
.ex__soon-head p { color:var(--muted); font-size:14px; margin:0; }
/* Rows / carousels */
.ex__row { margin-top:26px; }
.ex__row-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.ex__row-title { display:flex; align-items:center; gap:9px; font-size:16px; font-weight:600; margin:0; letter-spacing:-.01em; }
.ex__row-ic { width:17px; height:17px; color:var(--muted); }
.ex__row-arrows { display:flex; gap:6px; }
.ex__arrow { width:30px; height:30px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--text); font-size:17px; line-height:1; cursor:pointer; transition:background .15s; }
.ex__arrow:hover { background:var(--surface-hover); }
.ex__scroller { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(230px, 260px); gap:14px; overflow-x:auto; scroll-snap-type:x proximity; padding:4px 2px 10px; scrollbar-width:thin; }
.ex__scroller::-webkit-scrollbar { height:8px; }
.ex__scroller::-webkit-scrollbar-thumb { background:var(--border-strong); border-radius:8px; }
.ex__scroll-item { scroll-snap-align:start; }
/* Grid (topic view) */
.ex__grid-head { display:flex; align-items:center; gap:10px; font-size:16px; font-weight:600; margin-bottom:16px; }
.ex__count { font-family:var(--mono); font-size:12px; color:var(--faint); font-weight:400; }
.ex__grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:16px; }
/* Card */
.ex__card { background:var(--surface); border:1px solid var(--border); border-radius:15px; overflow:hidden; display:flex; flex-direction:column; height:100%; cursor:default; animation:ex-rise .45s cubic-bezier(.4,0,.2,1) both; transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
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
.ex__empty { color:var(--muted); font-size:15px; padding:40px 0; text-align:center; }
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
  .ex__btn, .ex__card, .ex__feed-card { transition:none; }
}
@media (max-width:820px){
  .ex__featured { grid-template-columns:1fr; }
  .ex__featured-cover { min-height:180px; }
  .ex__feed-strip { grid-template-columns:repeat(2, 1fr); }
  .ex__chips { top:0; position:relative; }
}
@media (max-width:520px){
  .ex__top-right .ex__btn--ghost { display:none; }
  .ex__hero-inner { padding-top:40px; }
  .ex__feed-strip { grid-template-columns:repeat(2, 1fr); }
  .ex__row-arrows { display:none; }
}
`
