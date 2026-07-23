'use client'

import React, { useState } from 'react'
import Link from 'next/link'

/**
 * Витрина проектов (/explore) — аналог patreon.com/explore, но без поиска:
 * только фильтр чипсами по темам. Основная масса проектов — «закрытые»
 * (на замке, витринный контент, задают тон площадки). Единственный действующий
 * проект — BTS Russia — вынесен в крупный featured-блок (≈×4) с лентой
 * публикаций и переходом на его отдельный сайт.
 *
 * Контент проектов — витринный (демо). Реальные данные BTS Russia настраиваются
 * константой BTS ниже. Тема (свет/тьма) наследуется с лендинга.
 */

// !!! Настройте под реальный сайт BTS Russia.
const BTS = {
  name: 'BTS Russia',
  topicLabel: 'Музыка · Фандом',
  tagline: 'Крупнейшее русскоязычное сообщество ARMY: эксклюзивы, переводы, разборы и живые эфиры.',
  siteUrl: 'https://bts.contentbox.site',
  subs: '48.2K',
  publications: [
    { title: 'Разбор нового клипа: кадр за кадром', tag: 'Видео', grad: 0 },
    { title: 'Перевод интервью для Weverse Magazine', tag: 'Текст', grad: 2 },
    { title: 'Живой эфир: обсуждаем комбэк', tag: 'Эфир', grad: 4 },
    { title: 'Фотоотчёт со встречи фан-клуба', tag: 'Галерея', grad: 1 },
  ],
}

type Topic = {
  value: string
  label: string
}

const TOPICS: Topic[] = [
  { value: 'all', label: 'Все' },
  { value: 'new', label: 'Новое' },
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

type Project = {
  name: string
  topic: string
  tagline: string
  subs: string
  grad: number
  isNew?: boolean
}

// Витринные (закрытые) проекты. Названия и описания — демо, задают дискурс площадки.
const PROJECTS: Project[] = [
  { name: 'Ночной эфир', topic: 'podcasts', tagline: 'Разговоры до рассвета: гости, музыка, звонки в студию.', subs: '3.1K' },
  { name: 'Две кружки', topic: 'podcasts', tagline: 'Подкаст о кино и сериалах без спойлеров… почти.', subs: '1.2K', isNew: true },
  { name: 'Тихий час', topic: 'podcasts', tagline: 'Медленные беседы о книгах и внутренней тишине.', subs: '820' },
  { name: 'Тушь и свет', topic: 'visual_arts', tagline: 'Иллюстрация, скетчбук и разборы процесса.', subs: '5.8K' },
  { name: 'Мастерская Лины', topic: 'visual_arts', tagline: 'Цифровой арт, кисти и таймлапсы по подписке.', subs: '2.4K' },
  { name: 'Раскадровка', topic: 'visual_arts', tagline: 'Сторибординг и концепт-арт для анимации.', subs: '640', isNew: true },
  { name: 'Кубик раздора', topic: 'tabletop', tagline: 'Настолки, D&D-кампании и печатные материалы.', subs: '4.0K' },
  { name: 'Гильдия за столом', topic: 'tabletop', tagline: 'Обзоры новинок и сценарии для своих игр.', subs: '1.7K' },
  { name: 'Пиксельный подвал', topic: 'video_games', tagline: 'Инди и ретро: находки, гайды, стримы.', subs: '9.3K' },
  { name: 'Спидран-клуб', topic: 'video_games', tagline: 'Прохождения на время и разбор трюков.', subs: '2.9K' },
  { name: 'Босс на минималках', topic: 'video_games', tagline: 'Сложные игры без урона — гайды и заезды.', subs: '1.1K', isNew: true },
  { name: 'Гараж 47', topic: 'music', tagline: 'Лоу-фай, синты и записи из домашней студии.', subs: '6.5K' },
  { name: 'Полутон', topic: 'music', tagline: 'Электроника и эмбиент, пресеты и семплы.', subs: '2.0K' },
  { name: 'Медленное утро', topic: 'lifestyle', tagline: 'Быт, осознанность и уют без спешки.', subs: '7.2K' },
  { name: 'Дом на колёсах', topic: 'lifestyle', tagline: 'Тревел и ван-лайф: маршруты и лайфхаки.', subs: '3.6K' },
  { name: 'Черновик', topic: 'writing', tagline: 'Проза с продолжением — глава за главой.', subs: '4.8K' },
  { name: 'Между строк', topic: 'writing', tagline: 'Эссе, заметки и письма подписчикам.', subs: '1.9K', isNew: true },
  { name: 'Петля и нить', topic: 'handicrafts', tagline: 'Вязание и схемы: от простого к сложному.', subs: '2.7K' },
  { name: 'Глина и руки', topic: 'handicrafts', tagline: 'Керамика, гончарный круг и обжиг.', subs: '980' },
  { name: 'Кодовый ужин', topic: 'apps', tagline: 'Разбор пет-проектов и код-ревью в прямом эфире.', subs: '5.1K' },
  { name: 'Софт по выходным', topic: 'apps', tagline: 'Маленькие приложения и их исходники.', subs: '1.5K', isNew: true },
  { name: 'Тёплый круг', topic: 'social', tagline: 'Волонтёрство и взаимопомощь по-соседски.', subs: '3.3K' },
  { name: 'Зелёный двор', topic: 'social', tagline: 'Экоинициативы и городские посадки.', subs: '1.4K' },
  { name: 'Бетон', topic: 'music', tagline: 'Индустриальная электроника и лайв-сеты.', subs: '2.2K' },
].map((p, i) => ({ ...p, grad: i % 6 }))

const GRADS = [
  'linear-gradient(135deg,#7c3aed,#4338ca)',
  'linear-gradient(135deg,#0ea5e9,#2563eb)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#10b981,#0891b2)',
  'linear-gradient(135deg,#f43f5e,#a21caf)',
]

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
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

  const list =
    topic === 'all'
      ? PROJECTS
      : topic === 'new'
        ? PROJECTS.filter((p) => p.isNew)
        : PROJECTS.filter((p) => p.topic === topic)

  const showFeatured = topic === 'all' || topic === 'music'

  return (
    <div className="explore">
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{EXPLORE_CSS}</style>

      <header className="ex__top">
        <Link href="/" className="ex__logo">
          Контент <span className="ex__logo-mono">Бокс</span>
        </Link>
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

      <main className="ex__main">
        <div className="ex__head">
          <h1 className="ex__title">Проекты авторов</h1>
          <p className="ex__lede">
            Смотрите, как авторы, контент-мейкеры и инфлюэнсеры ведут свои сообщества на Контент Боксе.
            Выберите тему — витрина закрытых проектов подскажет, для кого и о чём площадка.
          </p>
        </div>

        <div className="ex__chips" role="tablist" aria-label="Темы">
          {TOPICS.map((t) => (
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
            <div className="ex__featured-cover" style={{ background: GRADS[0] }}>
              <span className="ex__badge ex__badge--live">● Действующий проект</span>
              <div className="ex__featured-avatar">BTS</div>
            </div>
            <div className="ex__featured-body">
              <div className="ex__featured-topic">{BTS.topicLabel}</div>
              <h2 className="ex__featured-name">{BTS.name}</h2>
              <p className="ex__featured-tag">{BTS.tagline}</p>
              <div className="ex__featured-meta">{BTS.subs} подписчиков</div>

              <div className="ex__feed">
                <div className="ex__feed-head">Лента публикаций</div>
                <div className="ex__feed-strip">
                  {BTS.publications.map((p, i) => (
                    <a key={i} href={BTS.siteUrl} target="_blank" rel="noopener noreferrer" className="ex__feed-card">
                      <span className="ex__feed-thumb" style={{ background: GRADS[p.grad] }} />
                      <span className="ex__feed-tag">{p.tag}</span>
                      <span className="ex__feed-title">{p.title}</span>
                    </a>
                  ))}
                </div>
              </div>

              <div className="ex__featured-actions">
                <a href={BTS.siteUrl} target="_blank" rel="noopener noreferrer" className="ex__btn ex__btn--primary">
                  Перейти на сайт →
                </a>
                <a href={BTS.siteUrl} target="_blank" rel="noopener noreferrer" className="ex__btn ex__btn--ghost">
                  Все публикации
                </a>
              </div>
            </div>
          </section>
        )}

        <div className="ex__grid-head">
          {topic === 'all' ? 'Скоро на площадке' : TOPIC_LABEL[topic] || 'Проекты'}
          <span className="ex__count">{list.length}</span>
        </div>

        {list.length === 0 ? (
          <div className="ex__empty">В этой теме пока нет проектов. Загляните позже.</div>
        ) : (
          <div className="ex__grid">
            {list.map((p) => (
              <article key={p.name} className="ex__card" aria-disabled title="Скоро открытие">
                <div className="ex__card-cover" style={{ background: GRADS[p.grad] }}>
                  <span className="ex__lock"><LockIcon /></span>
                  {p.isNew && <span className="ex__badge ex__badge--new">Новое</span>}
                </div>
                <div className="ex__card-body">
                  <div className="ex__card-topic">{TOPIC_LABEL[p.topic]}</div>
                  <h3 className="ex__card-name">{p.name}</h3>
                  <p className="ex__card-tag">{p.tagline}</p>
                  <div className="ex__card-foot">
                    <span className="ex__card-subs">{p.subs} подписчиков</span>
                    <span className="ex__card-soon"><LockIcon /> Скоро</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
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
  --accent:#ffffff; --accent-text:#0a0a0b; --accent-hover:#e4e4e7;
  --live:#4ade80;
}
.theme-light .explore {
  --bg:#fafafa; --surface:#ffffff; --surface-2:#f4f4f5; --surface-hover:#ececee;
  --border:#e4e4e7; --border-strong:#d4d4d8;
  --text:#18181b; --muted:#52525b; --faint:#a1a1aa;
  --accent:#18181b; --accent-text:#ffffff; --accent-hover:#27272a;
  --live:#16a34a;
}
.ex__top {
  position:sticky; top:0; z-index:10; display:flex; align-items:center; justify-content:space-between;
  gap:16px; padding:14px max(20px, calc((100vw - 1120px)/2 + 20px));
  background:color-mix(in srgb, var(--bg) 80%, transparent); backdrop-filter:blur(14px);
  border-bottom:1px solid var(--border);
}
.ex__logo { font-weight:600; font-size:18px; color:var(--text); text-decoration:none; letter-spacing:-.01em; }
.ex__logo-mono { font-family:var(--mono); color:var(--muted); font-weight:500; }
.ex__top-right { display:flex; align-items:center; gap:10px; }
.ex__icon-btn {
  display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px;
  color:var(--text); background:transparent; border:1px solid var(--border); border-radius:9px; cursor:pointer;
}
.ex__icon-btn:hover { background:var(--surface-hover); }
.ex__btn {
  display:inline-flex; align-items:center; gap:8px; padding:9px 16px; font-size:14px; font-weight:600;
  border-radius:9px; text-decoration:none; cursor:pointer; border:1px solid transparent; font-family:var(--sans);
  transition:background .15s ease, border-color .15s ease; white-space:nowrap;
}
.ex__btn--primary { background:var(--accent); color:var(--accent-text); }
.ex__btn--primary:hover { background:var(--accent-hover); }
.ex__btn--ghost { background:transparent; color:var(--text); border-color:var(--border); }
.ex__btn--ghost:hover { background:var(--surface-hover); }
.ex__btn--lg { padding:13px 24px; font-size:15px; }
.ex__main { max-width:1120px; margin:0 auto; padding:36px max(20px, calc((100vw - 1120px)/2 + 20px)) 80px; }
.ex__head { margin-bottom:22px; }
.ex__title { font-size:clamp(28px,4vw,40px); font-weight:600; letter-spacing:-.02em; margin:0 0 10px; }
.ex__lede { font-size:16px; color:var(--muted); line-height:1.55; max-width:640px; margin:0; }
.ex__chips { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:28px; }
.ex__chip {
  padding:8px 14px; font-size:13.5px; font-family:var(--sans); cursor:pointer;
  color:var(--muted); background:var(--surface); border:1px solid var(--border); border-radius:999px;
  transition:color .15s ease, background .15s ease, border-color .15s ease; white-space:nowrap;
}
.ex__chip:hover { color:var(--text); background:var(--surface-hover); }
.ex__chip.is-active { color:var(--accent-text); background:var(--accent); border-color:var(--accent); }
/* Featured BTS */
.ex__featured {
  display:grid; grid-template-columns:minmax(280px, 420px) 1fr; gap:0; margin-bottom:36px;
  background:var(--surface); border:1px solid var(--border-strong); border-radius:18px; overflow:hidden;
  box-shadow:0 30px 60px rgba(0,0,0,.18);
}
.ex__featured-cover { position:relative; min-height:260px; padding:20px; }
.ex__featured-avatar {
  position:absolute; left:24px; bottom:24px; width:96px; height:96px; border-radius:22px;
  display:flex; align-items:center; justify-content:center; font-weight:700; font-size:30px; color:#fff;
  background:rgba(0,0,0,.35); border:2px solid rgba(255,255,255,.6); backdrop-filter:blur(4px);
}
.ex__badge {
  display:inline-flex; align-items:center; gap:6px; padding:5px 11px; border-radius:999px;
  font-family:var(--mono); font-size:11.5px; font-weight:500;
}
.ex__badge--live { background:rgba(0,0,0,.4); color:#fff; }
.ex__badge--live { color:#fff; }
.ex__featured-cover .ex__badge--live { position:relative; }
.ex__featured-body { padding:26px 28px; display:flex; flex-direction:column; }
.ex__featured-topic { font-family:var(--mono); font-size:12px; color:var(--muted); letter-spacing:.08em; margin-bottom:8px; }
.ex__featured-name { font-size:30px; font-weight:700; letter-spacing:-.02em; margin:0 0 8px; }
.ex__featured-tag { font-size:15px; color:var(--muted); line-height:1.5; margin:0 0 6px; }
.ex__featured-meta { font-family:var(--mono); font-size:12.5px; color:var(--faint); margin-bottom:18px; }
.ex__feed { border-top:1px solid var(--border); padding-top:16px; margin-bottom:18px; }
.ex__feed-head { font-family:var(--mono); font-size:12px; color:var(--muted); margin-bottom:12px; letter-spacing:.06em; }
.ex__feed-strip { display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; }
.ex__feed-card {
  display:flex; flex-direction:column; gap:7px; text-decoration:none; color:var(--text);
  background:var(--surface-2); border:1px solid var(--border); border-radius:10px; padding:8px; transition:border-color .15s ease;
}
.ex__feed-card:hover { border-color:var(--border-strong); }
.ex__feed-thumb { display:block; height:56px; border-radius:7px; }
.ex__feed-tag { font-family:var(--mono); font-size:10.5px; color:var(--faint); }
.ex__feed-title { font-size:12.5px; line-height:1.35; }
.ex__featured-actions { display:flex; gap:10px; margin-top:auto; flex-wrap:wrap; }
/* Grid */
.ex__grid-head {
  display:flex; align-items:center; gap:10px; font-size:15px; font-weight:600; margin-bottom:16px;
}
.ex__count { font-family:var(--mono); font-size:12px; color:var(--faint); font-weight:400; }
.ex__grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:16px; }
.ex__card {
  background:var(--surface); border:1px solid var(--border); border-radius:14px; overflow:hidden;
  display:flex; flex-direction:column; opacity:.96;
}
.ex__card-cover { position:relative; height:120px; }
.ex__lock {
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  color:#fff; background:rgba(0,0,0,.28);
}
.ex__lock svg { width:22px; height:22px; opacity:.95; }
.ex__badge--new {
  position:absolute; top:10px; right:10px; background:rgba(0,0,0,.45); color:#fff;
}
.ex__card-body { padding:14px 15px; display:flex; flex-direction:column; gap:6px; }
.ex__card-topic { font-family:var(--mono); font-size:11px; color:var(--faint); letter-spacing:.05em; }
.ex__card-name { font-size:16px; font-weight:600; margin:0; letter-spacing:-.01em; }
.ex__card-tag { font-size:13px; color:var(--muted); line-height:1.45; margin:0; }
.ex__card-foot {
  display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:6px;
  padding-top:10px; border-top:1px solid var(--border);
}
.ex__card-subs { font-family:var(--mono); font-size:11.5px; color:var(--faint); }
.ex__card-soon { display:inline-flex; align-items:center; gap:5px; font-family:var(--mono); font-size:11.5px; color:var(--muted); }
.ex__card-soon svg { width:12px; height:12px; }
.ex__empty { color:var(--muted); font-size:15px; padding:40px 0; text-align:center; }
.ex__cta {
  margin-top:56px; text-align:center; padding:40px 20px; border-top:1px solid var(--border);
}
.ex__cta-title { font-size:24px; font-weight:600; letter-spacing:-.02em; margin:0 0 8px; }
.ex__cta-lede { font-size:15px; color:var(--muted); margin:0 0 20px; }
@media (max-width:820px){
  .ex__featured { grid-template-columns:1fr; }
  .ex__featured-cover { min-height:180px; }
  .ex__feed-strip { grid-template-columns:repeat(2, 1fr); }
}
@media (max-width:520px){
  .ex__top-right .ex__btn--ghost { display:none; }
  .ex__feed-strip { grid-template-columns:repeat(2, 1fr); }
}
`
