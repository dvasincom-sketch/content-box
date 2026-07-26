'use client'

import React, { useState, useRef, useEffect } from 'react'

/* ============================================================================
   Витрина-канон UI-kit (/ui). Полный реестр элементов фан-сайта: нет здесь —
   нет на сайте. Слева — липкая навигация со scroll-spy и контролами
   (тема + подложка). Мелкие демо — в плотной сетке, крупные — на всю ширину.
   Статус/счётчик — на каждом варианте. Всё на .c-* и токенах.
   ============================================================================ */

type Status = { used: boolean; count?: number }


const I = {
  check: (s = 16) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>),
  chevron: (s = 16) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>),
  play: (s = 24) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>),
  inbox: (s = 28) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>),
  info: (s = 18) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>),
  alert: (s = 18) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><path d="M12 9v4M12 17h.01" /></svg>),
  circleCheck: (s = 18) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>),
  bell: (s = 18) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>),
  search: (s = 18) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>),
  user: (s = 18) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>),
}

const NAV: Array<{ g: string; links: Array<[string, string]> }> = [
  { g: 'Основы', links: [['colors', 'Цвета'], ['radii', 'Радиусы'], ['type', 'Типографика']] },
  { g: 'Кнопки', links: [['btn-primary', 'Primary'], ['btn-outline', 'Outline'], ['btn-ghost', 'Ghost'], ['btn-soft', 'Soft'], ['btn-danger', 'Danger'], ['btn-icon', 'С иконкой'], ['btn-iconly', 'Иконочная'], ['btn-split', 'Сплит'], ['btn-sizes', 'Размеры'], ['btn-pill', 'Pill'], ['btn-surface', 'Нейтральная'], ['btn-states', 'Состояния']] },
  { g: 'Формы', links: [['inp-text', 'Поле'], ['inp-area', 'Textarea'], ['inp-error', 'Ошибка'], ['inp-pass', 'Пароль'], ['inp-dd', 'Дропдаун'], ['inp-search', 'Поиск'], ['ctl-toggle', 'Тумблер'], ['ctl-check', 'Чекбокс'], ['ctl-radio', 'Радио']] },
  { g: 'Навигация и метки', links: [['chips', 'Чипы-фильтры'], ['pubchip', 'Meta-чип'], ['navlink', 'Нав-ссылка'], ['badges', 'Бейджи'], ['rx', 'Реакции'], ['crumbs', 'Хлебные крошки'], ['pager', 'Пагинация'], ['tabs', 'Табы']] },
  { g: 'Карточки', links: [['card', 'Карточка'], ['card-int', 'Интерактивная'], ['tier', 'Тариф'], ['poster', 'Постер'], ['tile', 'Плитка-категория'], ['empty', 'Пустое'], ['avatar', 'Аватары'], ['comment', 'Комментарий']] },
  { g: 'Обратная связь', links: [['alerts', 'Алерты'], ['tooltip', 'Тултип'], ['loading', 'Загрузка'], ['progress', 'Прогресс'], ['stat', 'Метрики'], ['table', 'Таблица']] },
]

function StatusPill({ status }: { status: Status }) {
  if (status.used) return (<span className={`uikit-count${status.count == null ? ' uikit-count--dot' : ''}`} title="используется на сайте">{status.count ?? ''}</span>)
  return (<span className="uikit-status uikit-status--new"><span className="uikit-status__dot" />новый</span>)
}

function Item({ id, name, code, status, col, wide, children }: { id: string; name: string; code: string; status: Status; col?: boolean; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`uikit-item uikit-anchor${wide ? ' uikit-item--wide' : ''}`} id={id}>
      <div className="uikit-item__head">
        <span className="uikit-item__name">{name}</span>
        <code className="uikit-item__code">{code}</code>
        <StatusPill status={status} />
      </div>
      <div className={`uikit-item__demo${col ? ' uikit-item__demo--col' : ''}`}>{children}</div>
    </div>
  )
}

function Dropdown({ options, placeholder }: { options: string[]; placeholder: string }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])
  return (
    <div ref={ref} style={{ width: '100%', maxWidth: 320 }}>
      <div className={`c-select-wrap${open ? ' is-open' : ''}`}>
        <button type="button" className="c-select" style={{ textAlign: 'left', color: selected ? 'var(--brand-text)' : 'var(--brand-muted)' }} onClick={() => setOpen((v) => !v)}>{selected || placeholder}</button>
      </div>
      {open && (
        <div className="c-popover" style={{ marginTop: 6 }}>
          {options.map((opt) => (
            <button key={opt} type="button" className={`c-popover__item${selected === opt ? ' is-active' : ''}`} onClick={() => { setSelected(opt); setOpen(false) }}>
              {opt}{selected === opt && <span style={{ color: 'var(--brand-primary)', display: 'inline-flex' }}>{I.check(15)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function UIShowcaseExtra() {
  const [theme, setTheme] = useState<'theme-dark' | 'theme-light'>('theme-dark')
  const [bg, setBg] = useState(false)
  const [active, setActive] = useState('')
  const [toggle, setToggle] = useState(true)
  const [checked, setChecked] = useState(true)
  const [radio, setRadio] = useState('a')
  const [tab, setTab] = useState(0)
  const [page, setPage] = useState(2)
  const [showPass, setShowPass] = useState(false)
  const [rxOpen, setRxOpen] = useState<null | 'fire' | 'heart'>(null)
  const rxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!rxOpen) return
    const onDown = (e: MouseEvent) => {
      if (rxRef.current && !rxRef.current.contains(e.target as Node)) setRxOpen(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [rxOpen])

  useEffect(() => {
    const ids = NAV.flatMap((g) => g.links.map((l) => l[0]))
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting)
        if (vis.length) {
          const top = vis.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b))
          setActive((top.target as HTMLElement).id)
        }
      },
      { rootMargin: '-12% 0px -75% 0px', threshold: 0 },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const swatches: Array<[string, string]> = [
    ['Primary', 'var(--brand-primary)'], ['Accent', 'var(--brand-accent)'], ['Background', 'var(--brand-bg)'],
    ['Surface', 'var(--brand-surface)'], ['Text', 'var(--brand-text)'], ['Success', 'var(--success)'],
    ['Danger', 'var(--danger)'], ['Info', 'var(--info)'], ['Warn', 'var(--warn)'],
  ]
  const tabs = ['Обзор', 'Видео', 'Отзывы']
  const navLink = (id: string, label: string) => (
    <a key={id} className={`uikit-nav__link${active === id ? ' is-active' : ''}`} href={`#${id}`}>{label}</a>
  )

  return (
    <div className={`uikit-canvas ${theme}`} style={bg ? { background: 'radial-gradient(50% 40% at 12% 4%, color-mix(in srgb, var(--brand-primary) 65%, transparent), transparent 55%), radial-gradient(45% 40% at 88% 12%, color-mix(in srgb, var(--brand-accent) 55%, transparent), transparent 55%), radial-gradient(60% 55% at 50% 108%, color-mix(in srgb, var(--brand-primary) 50%, transparent), transparent 62%), var(--brand-bg)' } : undefined}>
      <div className="uikit">
        <div className="uikit__bar">
          <div>
            <div className="uikit__title">UI-kit · COCO JAMBO</div>
            <div className="uikit__sub">Полный реестр элементов фан-сайта. Нет здесь — нет на сайте. Статус и счётчик — на каждом варианте.</div>
          </div>
        </div>
        <div className="uikit__legend">
          <StatusPill status={{ used: true, count: 12 }} /><span>— число = сколько мест на сайте</span>
          <StatusPill status={{ used: false }} /><span>— заведён в канон, в проде 0</span>
        </div>

        <div className="uikit-shell">
          <nav className="uikit-nav" aria-label="Элементы">
            <div className="uikit-nav__controls">
              <div className="uikit-nav__seg" role="group" aria-label="Тема">
                <button type="button" className={`c-btn c-btn--sm ${theme === 'theme-dark' ? 'c-btn--primary c-spotlight c-spotlight-bright' : 'c-btn--outline c-spotlight'}`} onClick={() => setTheme('theme-dark')}>Тёмная</button>
                <button type="button" className={`c-btn c-btn--sm ${theme === 'theme-light' ? 'c-btn--primary c-spotlight c-spotlight-bright' : 'c-btn--outline c-spotlight'}`} onClick={() => setTheme('theme-light')}>Светлая</button>
              </div>
              <label className="c-toggle" style={{ fontSize: 13 }}>
                <input className="c-toggle__input" type="checkbox" checked={bg} onChange={() => setBg((v) => !v)} />
                <span className="c-toggle__track"><span className="c-toggle__knob" /></span>Подложка
              </label>
            </div>
            {NAV.map((grp) => (
              <React.Fragment key={grp.g}>
                <div className="uikit-nav__group">{grp.g}</div>
                {grp.links.map(([id, label]) => navLink(id, label))}
              </React.Fragment>
            ))}
          </nav>

            <div>
              <div className="uikit-group__label">Основы</div>
              <div className="uikit-grid">
                <Item id="colors" name="Цвета" code="--brand-* · статус-токены" status={{ used: true }} col wide>
                  <div className="uikit-swatches" style={{ width: '100%' }}>
                    {swatches.map(([label, val]) => (
                      <div key={label}>
                        <div className="uikit-swatch__chip" style={{ background: val }} />
                        <div className="uikit-swatch__name">{label}</div>
                        <div className="uikit-swatch__val">{val.replace('var(', '').replace(')', '')}</div>
                      </div>
                    ))}
                  </div>
                </Item>
                <Item id="radii" name="Радиусы" code="контрол 12 · поверхность 16 · pill" status={{ used: true }}>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div className="uikit-radii__box" style={{ borderRadius: 'var(--radius-md)' }}>12</div>
                    <div className="uikit-radii__box" style={{ borderRadius: 'var(--radius-lg)' }}>16</div>
                    <div className="uikit-radii__box" style={{ borderRadius: 'var(--radius-pill)' }}>pill</div>
                  </div>
                </Item>
                <Item id="type" name="Типографика" code="--font-heading · text-*" status={{ used: true }} col wide>
                  <div style={{ display: 'grid', gap: 14, width: '100%' }}>
                    {([
                      ['Display H1', 34, 700, '-0.02em', 'var(--font-heading)', { used: true, count: 6 }, 'text-5xl · hero'],
                      ['Заголовок H2', 26, 700, '0', 'var(--font-heading)', { used: true, count: 8 }, 'text-3xl · секции'],
                      ['Заголовок карточки H3', 20, 600, '-0.01em', 'var(--font-heading)', { used: true, count: 5 }, 'text-lg'],
                      ['Основной текст (body)', 16, 400, '0', 'inherit', { used: true, count: 9 }, 'text-base'],
                      ['Мелкий / мета', 14, 400, '0', 'inherit', { used: true, count: 29 }, 'text-sm'],
                      ['Микро', 12, 400, '0', 'inherit', { used: false }, 'text-xs'],
                    ] as Array<[string, number, number, string, string, Status, string]>).map(([label, size, weight, ls, ff, st, code]) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: ff, fontSize: size, fontWeight: weight, letterSpacing: ls, color: st.used ? 'var(--brand-text)' : 'var(--brand-muted)' }}>{label}</span>
                        <code className="uikit-item__code">{code}</code>
                        <StatusPill status={st} />
                      </div>
                    ))}
                  </div>
                </Item>
              </div>

              <div className="uikit-group__label">Кнопки</div>
              <div className="uikit-grid">
                <Item id="btn-primary" name="Primary" code=".c-btn--primary" status={{ used: true, count: 10 }}><button className="c-btn c-btn--primary c-spotlight c-spotlight-bright">Оформить подписку</button></Item>
                <Item id="btn-outline" name="Outline" code=".c-btn--outline" status={{ used: true, count: 4 }}><button className="c-btn c-btn--outline c-spotlight">Подробнее</button></Item>
                <Item id="btn-ghost" name="Ghost" code=".c-btn--ghost" status={{ used: true, count: 2 }}><button className="c-btn c-btn--ghost">Выйти</button></Item>
                <Item id="btn-soft" name="Soft" code=".c-btn--soft" status={{ used: false }}><button className="c-btn c-btn--soft c-spotlight">Показать ещё</button></Item>
                <Item id="btn-danger" name="Danger" code=".c-btn--danger" status={{ used: false }}><button className="c-btn c-btn--danger">Отменить</button></Item>
                <Item id="btn-icon" name="С иконкой" code="icon + label" status={{ used: true, count: 2 }}>
                  <button className="c-btn c-btn--primary c-spotlight c-spotlight-bright">{I.user(16)} Войти</button>
                  <button className="c-btn c-btn--outline c-spotlight">{I.search(16)} Искать</button>
                </Item>
                <Item id="btn-iconly" name="Иконочная" code=".c-btn--icon" status={{ used: true, count: 3 }}>
                  <button className="c-btn c-btn--outline c-btn--icon c-spotlight" aria-label="Уведомления">{I.bell(18)}</button>
                  <button className="c-btn c-btn--ghost c-btn--icon" aria-label="Поиск">{I.search(18)}</button>
                </Item>
                <Item id="btn-surface" name="Нейтральная (иконки шапки)" code=".c-btn--surface" status={{ used: true, count: 3 }}>
                  <button className="c-btn c-btn--surface c-btn--icon c-spotlight" aria-label="Поиск">{I.search(18)}</button>
                  <button className="c-btn c-btn--surface c-spotlight">{I.bell(16)} С текстом</button>
                </Item>
                <Item id="btn-split" name="Сплит" code=".c-segment" status={{ used: true, count: 1 }}>
                  <div className="c-segment"><a className="c-segment__item" href="#">Войти</a><span className="c-segment__divider" /><a className="c-segment__item c-segment__item--primary" href="#">Регистрация</a></div>
                </Item>
                <Item id="btn-sizes" name="Размеры" code="--sm / md / --lg" status={{ used: true, count: 26 }} col>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><button className="c-btn c-btn--primary c-btn--sm c-spotlight c-spotlight-bright">Sm</button><StatusPill status={{ used: true, count: 6 }} /></span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><button className="c-btn c-btn--primary c-spotlight c-spotlight-bright">Md</button><StatusPill status={{ used: true, count: 20 }} /></span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><button className="c-btn c-btn--primary c-btn--lg c-spotlight c-spotlight-bright">Lg</button><StatusPill status={{ used: false }} /></span>
                  </div>
                </Item>
                <Item id="btn-pill" name="Pill" code=".c-btn--pill" status={{ used: true, count: 9 }}>
                  <button className="c-btn c-btn--primary c-btn--pill c-spotlight c-spotlight-bright">Подписаться</button>
                  <button className="c-btn c-btn--outline c-btn--pill c-spotlight">Отписаться</button>
                </Item>
                <Item id="btn-states" name="Состояния" code="default / hover / focus / disabled" status={{ used: true }} wide>
                  <div className="uikit-states">
                    <div className="uikit-state"><button className="c-btn c-btn--primary">Default</button><span className="uikit-state__label">default</span></div>
                    <div className="uikit-state"><button className="c-btn c-btn--primary u-hover">Hover</button><span className="uikit-state__label">hover</span></div>
                    <div className="uikit-state"><button className="c-btn c-btn--primary u-focus">Focus</button><span className="uikit-state__label">focus-ring</span></div>
                    <div className="uikit-state"><button className="c-btn c-btn--primary" disabled>Disabled</button><span className="uikit-state__label">disabled</span></div>
                  </div>
                </Item>
              </div>

              <div className="uikit-group__label">Формы</div>
              <div className="uikit-grid">
                <Item id="inp-text" name="Поле ввода" code=".c-input · .c-field" status={{ used: true, count: 9 }} col>
                  <label className="c-field" style={{ width: '100%' }}><span className="c-field__label">Почта</span><input className="c-input" placeholder="you@example.com" /><span className="c-field__hint">Фокус — бордер primary 60% + --focus-ring.</span></label>
                </Item>
                <Item id="inp-area" name="Textarea" code=".c-textarea" status={{ used: true, count: 1 }} col><textarea className="c-textarea" style={{ width: '100%' }} placeholder="Комментарий…" /></Item>
                <Item id="inp-error" name="Ошибка" code=".c-input--error" status={{ used: true, count: 2 }} col>
                  <label className="c-field" style={{ width: '100%' }}><span className="c-field__label">Почта</span><input className="c-input c-input--error" defaultValue="неверно@" /><span className="c-field__error">Проверьте адрес почты.</span></label>
                </Item>
                <Item id="inp-pass" name="Пароль" code=".c-input-affix" status={{ used: false }} col>
                  <div className="c-input-affix" style={{ width: '100%' }}><input className="c-input" type={showPass ? 'text' : 'password'} placeholder="••••••••" /><button type="button" className="c-input-affix__btn" onClick={() => setShowPass((v) => !v)}>{showPass ? 'скрыть' : 'показать'}</button></div>
                </Item>
                <Item id="inp-dd" name="Дропдаун-меню" code=".c-popover" status={{ used: true, count: 2 }} col><Dropdown placeholder="Кастомный дропдаун…" options={['RM', 'Jin', 'SUGA', 'j-hope', 'Jimin', 'V']} /></Item>
                <Item id="inp-search" name="Поиск" code=".c-input + иконка" status={{ used: true, count: 1 }} col>
                  <div style={{ position: 'relative', width: '100%' }}><span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--brand-muted)', display: 'inline-flex', pointerEvents: 'none' }}>{I.search(18)}</span><input className="c-input" style={{ paddingLeft: 44 }} placeholder="Поиск по сайту…" /></div>
                </Item>
                <Item id="ctl-toggle" name="Тумблер" code=".c-toggle" status={{ used: true, count: 6 }}>
                  <label className="c-toggle"><input className="c-toggle__input" type="checkbox" checked={toggle} onChange={() => setToggle((v) => !v)} /><span className="c-toggle__track"><span className="c-toggle__knob" /></span>С озвучкой</label>
                </Item>
                <Item id="ctl-check" name="Чекбокс" code=".c-check" status={{ used: false }}>
                  <label className="c-check"><input className="c-check__input" type="checkbox" checked={checked} onChange={() => setChecked((v) => !v)} /><span className="c-check__box">{I.check(14)}</span>Согласен</label>
                </Item>
                <Item id="ctl-radio" name="Радио" code=".c-radio" status={{ used: false }} col>
                  {['a', 'b'].map((r) => (<label key={r} className="c-radio"><input className="c-radio__input" type="radio" name="demo-radio" checked={radio === r} onChange={() => setRadio(r)} /><span className="c-radio__box"><span className="c-radio__dot" /></span>Вариант {r.toUpperCase()}</label>))}
                </Item>
              </div>

              <div className="uikit-group__label">Навигация и метки</div>
              <div className="uikit-grid">
                <Item id="chips" name="Чипы-фильтры" code=".c-chip" status={{ used: true, count: 6 }}>
                  <button className="c-chip c-chip--active">Все</button><button className="c-chip">Публикации</button><button className="c-chip">Афиши</button>
                </Item>
                <Item id="pubchip" name="Meta-чип публикации" code=".pubmeta-chip · .pubmeta-date" status={{ used: true, count: 2 }}>
                  <span className="pubmeta-chip">Концерты</span><span className="pubmeta-date">26 июля 2026</span>
                </Item>
                <Item id="navlink" name="Навигационная ссылка" code=".c-navlink" status={{ used: true, count: 20 }}>
                  <a href="#" className="c-navlink">Главная</a>
                  <a href="#" className="c-navlink">О проекте</a>
                  <a href="#" className="c-navlink">Контакты</a>
                </Item>
                <Item id="badges" name="Бейджи" code=".c-badge --*" status={{ used: true, count: 5 }} col wide>
                  <table className="c-table" style={{ width: '100%' }}>
                    <thead><tr><th>Пример</th><th>Класс</th><th>Статус</th></tr></thead>
                    <tbody>
                      {([
                        [<span className="c-badge c-badge--primary">Primary</span>, '--primary', { used: true, count: 4 }],
                        [<span className="c-badge c-badge--accent">Accent</span>, '--accent', { used: true, count: 1 }],
                        [<span className="c-badge c-badge--soft">Мягкий</span>, '--soft', { used: false }],
                        [<span className="c-badge c-badge--neutral">Нейтраль</span>, '--neutral', { used: false }],
                        [<span className="c-badge c-badge--success">{I.check(12)} Успех</span>, '--success', { used: false }],
                        [<span className="c-badge c-badge--danger">Отменён</span>, '--danger', { used: false }],
                        [<span className="c-badge c-badge--warn">Истекает</span>, '--warn', { used: false }],
                        [<span className="c-badge c-badge--info">Инфо</span>, '--info', { used: false }],
                      ] as Array<[React.ReactNode, string, Status]>).map(([badge, cls, st], i) => (
                        <tr key={i}>
                          <td>{badge}</td>
                          <td className="is-muted"><code className="uikit-item__code">{cls}</code></td>
                          <td><StatusPill status={st} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Item>
                <Item id="rx" name="Реакции" code=".rx-pill · .rx-main · .rx-pop" status={{ used: true, count: 10 }}>
                  <div className="rx-row" ref={rxRef}>
                    <span className="rx-pop-wrap">
                      <span className={`rx-pill${rxOpen === 'fire' ? ' is-active' : ''}`}>
                        <button className="rx-main"><span className="rx-emo">🔥</span>12</button>
                        <button className="rx-caret" aria-label="Кто поставил" aria-expanded={rxOpen === 'fire'} onClick={() => setRxOpen((v) => (v === 'fire' ? null : 'fire'))}>{I.chevron(10)}</button>
                      </span>
                      {rxOpen === 'fire' && (
                        <div className="rx-pop rx-pop--left" role="dialog">
                          <div className="rx-pop__head">🔥 Поставили реакцию</div>
                          {['RM', 'Jin', 'SUGA'].map((n) => (
                            <div className="rx-pop__row" key={n}><span className="c-avatar c-avatar--sm">{n[0]}</span><span className="rx-pop__name">{n}</span></div>
                          ))}
                        </div>
                      )}
                    </span>
                    <span className="rx-pop-wrap">
                      <span className={`rx-pill${rxOpen === 'heart' ? ' is-active' : ''}`}>
                        <button className="rx-main"><span className="rx-emo">💜</span>8</button>
                        <button className="rx-caret" aria-label="Кто поставил" aria-expanded={rxOpen === 'heart'} onClick={() => setRxOpen((v) => (v === 'heart' ? null : 'heart'))}>{I.chevron(10)}</button>
                      </span>
                      {rxOpen === 'heart' && (
                        <div className="rx-pop rx-pop--left" role="dialog">
                          <div className="rx-pop__head">💜 Поставили реакцию</div>
                          {['Jimin', 'V', 'JK'].map((n) => (
                            <div className="rx-pop__row" key={n}><span className="c-avatar c-avatar--sm">{n[0]}</span><span className="rx-pop__name">{n}</span></div>
                          ))}
                        </div>
                      )}
                    </span>
                  </div>
                </Item>
                <Item id="crumbs" name="Хлебные крошки" code=".breadcrumbs" status={{ used: true, count: 3 }}>
                  <nav className="breadcrumbs" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: 'var(--brand-muted)' }}>
                    <a href="#" style={{ textDecoration: 'none', color: 'inherit' }}>Главная</a><span>/</span><a href="#" style={{ textDecoration: 'none', color: 'inherit' }}>Концерты</a><span>/</span><span style={{ color: 'var(--brand-text)' }}>2026</span>
                  </nav>
                </Item>
                <Item id="pager" name="Пагинация" code=".c-pager" status={{ used: true, count: 3 }}>
                  <div className="c-pager">
                    <button className="c-pager__item" aria-disabled={page === 1} disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>←</button>
                    {[1, 2, 3, 4, 5].map((p) => (<button key={p} className={`c-pager__item${page === p ? ' is-active' : ''}`} onClick={() => setPage(p)}>{p}</button>))}
                    <button className="c-pager__item" aria-disabled={page === 5} disabled={page === 5} onClick={() => setPage((p) => Math.min(5, p + 1))}>→</button>
                  </div>
                </Item>
                <Item id="tabs" name="Табы" code=".c-tabs · .c-tab" status={{ used: false }} col wide>
                  <div className="c-tabs" style={{ width: '100%' }}>{tabs.map((label, i) => (<button key={label} className={`c-tab${tab === i ? ' is-active' : ''}`} onClick={() => setTab(i)}>{label}</button>))}</div>
                  <div style={{ fontSize: 14, color: 'var(--brand-muted)', marginTop: 14 }}>Содержимое вкладки «{tabs[tab]}».</div>
                </Item>
              </div>

              <div className="uikit-group__label">Карточки</div>
              <div className="uikit-grid">
                <Item id="card" name="Карточка" code=".c-card" status={{ used: true, count: 1 }}>
                  <div className="c-card" style={{ padding: 20, width: '100%' }}><div style={{ fontWeight: 600, marginBottom: 6 }}>Обычная карточка</div><div style={{ fontSize: 14, color: 'var(--brand-muted)' }}>Стекло --glass-2, бордер, --elev-2.</div></div>
                </Item>
                <Item id="card-int" name="Интерактивная" code=".c-card--interactive · .c-spotlight" status={{ used: true, count: 6 }}>
                  <div className="c-card c-card--interactive c-spotlight" style={{ padding: 20, width: '100%' }}><div className="c-icon-chip" style={{ marginBottom: 12 }}>{I.play(20)}</div><div style={{ fontWeight: 600, marginBottom: 6 }}>Наведите</div><div style={{ fontSize: 14, color: 'var(--brand-muted)' }}>Подъём -4px, бордер к акценту, спотлайт.</div></div>
                </Item>
                <Item id="tier" name="Тариф" code=".sub-card" status={{ used: true, count: 13 }}>
                  <div className="sub-card sub-card--hl" style={{ background: 'var(--glass-2)', border: '1px solid color-mix(in srgb, var(--brand-primary) 45%, transparent)', backdropFilter: 'blur(var(--glass-blur-2))', WebkitBackdropFilter: 'blur(var(--glass-blur-2))', width: '100%' }}>
                    <span className="sub-card__badge" style={{ background: 'var(--brand-primary)', color: '#fff' }}>ПОПУЛЯРНЫЙ</span>
                    <div className="sub-card__name">СОДЖУ</div>
                    <div className="sub-card__price"><span className="sub-card__price-cur">₽</span>630<span className="sub-card__price-per" style={{ color: 'var(--brand-muted)' }}>/мес</span></div>
                    <p className="sub-card__desc" style={{ color: 'var(--brand-muted)' }}>Переводы Weverse, эксклюзивы, без рекламы.</p>
                    <ul className="sub-card__perks">{['Всё из РАМЁН', 'Переводы Weverse', 'Эксклюзивы'].map((f) => (<li key={f} className="sub-card__perk"><span className="sub-card__perk-icon" style={{ color: 'var(--brand-primary)' }}>{I.check(15)}</span><span className="sub-card__perk-text">{f}</span></li>))}</ul>
                    <button className="c-btn c-btn--primary c-btn--block c-spotlight c-spotlight-bright">Оформить</button>
                  </div>
                </Item>
                <Item id="poster" name="Постер (2:3)" code=".poster-card" status={{ used: true, count: 8 }}>
                  <a className="poster-card" style={{ width: 130 }}><div className="poster-card__frame"><div className="poster-card__placeholder">BTS</div></div></a>
                  <a className="poster-card" style={{ width: 130 }}><div className="poster-card__frame"><div className="poster-card__placeholder">TXT</div></div></a>
                </Item>
                <Item id="tile" name="Плитка-категория (как на главной)" code=".c-tile / .c-card--interactive" status={{ used: true, count: 8 }}>
                  <a className="c-tile c-spotlight" style={{ width: 200, aspectRatio: '4 / 3', background: 'color-mix(in srgb, var(--brand-text) 12%, var(--brand-surface))' }}>
                    <div className="c-tile__scrim" />
                    <h3 className="relative" style={{ padding: 14, color: '#fff', fontWeight: 600, fontSize: 17 }}>С обложкой</h3>
                  </a>
                  <a className="c-card c-card--interactive c-spotlight" style={{ width: 200, aspectRatio: '4 / 3', padding: 20, display: 'flex', alignItems: 'flex-end' }}>
                    <h3 style={{ fontWeight: 600, fontSize: 17, color: 'var(--brand-text)' }}>Без обложки</h3>
                  </a>
                </Item>
                <Item id="empty" name="Пустое состояние" code=".c-empty" status={{ used: true, count: 4 }} col wide>
                  <div className="c-card" style={{ width: '100%' }}><div className="c-empty"><div className="c-empty__icon">{I.inbox(28)}</div><div className="c-empty__title">Пока нет видео</div><div className="c-empty__text">Новые переводы появятся здесь.</div><button className="c-btn c-btn--primary c-spotlight c-spotlight-bright">Оформить подписку</button></div></div>
                </Item>
                <Item id="avatar" name="Аватары" code=".c-avatar · --soft/sm/lg · -stack" status={{ used: true, count: 7 }}>
                  <span className="c-avatar c-avatar--sm">Д</span><span className="c-avatar">RM</span><span className="c-avatar c-avatar--soft c-avatar--lg">V</span>
                  <span className="c-avatar-stack"><span className="c-avatar c-avatar--sm">A</span><span className="c-avatar c-avatar--sm c-avatar--soft">B</span><span className="c-avatar c-avatar--sm">C</span></span>
                </Item>
                <Item id="comment" name="Комментарий" code=".cm-item · .cm-av · .cm-actions" status={{ used: true, count: 1 }} col wide>
                  <div className="cm-item" style={{ width: '100%' }}>
                    <span className="cm-av" style={{ width: 40, height: 40, background: 'var(--brand-primary)' }}>Д</span>
                    <div className="cm-body"><div className="cm-meta"><span className="cm-name">Дмитрий</span><span className="cm-when">2 ч назад</span></div><div className="cm-text">Перевод топ, спасибо! Ждём следующий концерт 💜</div><div className="cm-actions"><button className="cm-rx is-active">💜 3</button><span className="cm-sep">·</span><button className="cm-reply">Ответить</button></div></div>
                  </div>
                </Item>
              </div>

              <div className="uikit-group__label">Обратная связь</div>
              <div className="uikit-grid">
                <Item id="alerts" name="Алерты" code=".c-alert --success/danger/info/warn" status={{ used: true, count: 2 }} col wide>
                  <div style={{ display: 'grid', gap: 10, width: '100%' }}>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><div className="c-alert c-alert--danger" style={{ flex: 1 }}><span className="c-alert__icon">{I.alert(18)}</span><div className="c-alert__body">Не удалось провести оплату.</div></div><StatusPill status={{ used: true, count: 2 }} /></span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><div className="c-alert c-alert--success" style={{ flex: 1 }}><span className="c-alert__icon">{I.circleCheck(18)}</span><div className="c-alert__body">Подписка оформлена. Доступ открыт.</div></div><StatusPill status={{ used: false }} /></span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><div className="c-alert c-alert--info" style={{ flex: 1 }}><span className="c-alert__icon">{I.info(18)}</span><div className="c-alert__body">Новое видео в разделе «Концерты».</div></div><StatusPill status={{ used: false }} /></span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><div className="c-alert c-alert--warn" style={{ flex: 1 }}><span className="c-alert__icon">{I.alert(18)}</span><div className="c-alert__body">Подписка истекает через 3 дня.</div></div><StatusPill status={{ used: false }} /></span>
                  </div>
                </Item>
                <Item id="tooltip" name="Тултип" code=".c-tooltip-wrap · .c-tooltip" status={{ used: false }}>
                  <span className="c-tooltip-wrap"><button className="c-btn c-btn--outline c-spotlight">Наведите</button><span className="c-tooltip">Подсказка на стекле</span></span>
                </Item>
                <Item id="loading" name="Загрузка" code=".c-spinner · .c-skeleton" status={{ used: false }}>
                  <div className="c-spinner" />
                  <div style={{ flex: 1, minWidth: 160, display: 'grid', gap: 8 }}><div className="c-skeleton" style={{ height: 12, width: '80%' }} /><div className="c-skeleton" style={{ height: 12, width: '60%' }} /><div className="c-skeleton" style={{ height: 12, width: '70%' }} /></div>
                </Item>
                <Item id="progress" name="Прогресс" code=".c-progress" status={{ used: false }} col>
                  <div style={{ display: 'grid', gap: 12, width: '100%' }}>{[30, 65, 90].map((p) => (<div key={p}><div className="c-progress"><div className="c-progress__bar" style={{ width: `${p}%` }} /></div><div style={{ fontSize: 12, color: 'var(--brand-muted)', marginTop: 4 }}>{p}%</div></div>))}</div>
                </Item>
                <Item id="stat" name="Метрики" code=".c-stat" status={{ used: false }} col wide>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, width: '100%' }}>{[['Подписчиков', '15 868'], ['Выручка / мес', '312k ₽'], ['Видео', '631'], ['Отток', '2.4%']].map(([l, v]) => (<div key={l} className="c-stat"><div className="c-stat__label">{l}</div><div className="c-stat__value">{v}</div></div>))}</div>
                </Item>
                <Item id="table" name="Таблица" code=".c-table" status={{ used: false }} col wide>
                  <div className="c-card" style={{ width: '100%', padding: 0, overflow: 'hidden' }}>
                    <table className="c-table"><thead><tr><th>Подписчик</th><th>Уровень</th><th>До</th></tr></thead><tbody>{[['Дмитрий', 'СОДЖУ', '12.08'], ['Анна', 'РАМЁН', '03.09'], ['Игорь', 'САМГЁПСАЛЬ', '21.07']].map((row) => (<tr key={row[0]}><td>{row[0]}</td><td className="is-muted">{row[1]}</td><td className="is-muted">{row[2]}</td></tr>))}</tbody></table>
                  </div>
                </Item>
              </div>
            </div>
        </div>
      </div>
    </div>
  )
}
