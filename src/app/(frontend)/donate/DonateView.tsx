'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Heart, X, Sparkles, TrendingUp, Users, Shield, ChevronDown } from 'lucide-react'

export type DnGoal = {
  id: number | string
  title: string
  description: string
  targetRub: number
  raisedRub: number
}
export type DnSupporter = {
  id: number | string
  name: string
  amountRub: number
  message: string
  dateLabel: string
  isAnonymous: boolean
  goalTitle?: string
}

export type DonateViewProps = {
  brandName: string
  logoUrl: string | null
  goals: DnGoal[]
  supporters: DnSupporter[]
  totalRaisedRub: number
  supportersCount: number
  weekCount: number
  userName: string
  subscribeHref: string
  isDemo: boolean
}

const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0))
const rub = (n: number) => `${fmt(n)} ₽`

const PRESETS = [300, 500, 1000, 2000, 5000]
const PRESET_HINT: Record<number, string> = {
  300: 'кофе автору',
  500: 'лайк рублём',
  1000: 'час озвучки',
  2000: 'щедро',
  5000: 'меценат',
}

type GoalOpt = { value: string; label: string }
/** Кастомный дропдаун в стиле сайта (нативный <select> не даёт стилизовать сам список). */
function GoalSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: GoalOpt[] }) {
  const [open, setOpen] = useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const selected = options.find((o) => o.value === value) ?? options[0]
  return (
    <div className="dn-select" ref={ref}>
      <button type="button" className="dn-select__btn" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}>
        <span>{selected?.label}</span>
        <ChevronDown size={16} className={'dn-select__caret' + (open ? ' is-open' : '')} />
      </button>
      {open && (
        <ul className="dn-select__list" role="listbox">
          {options.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={'dn-select__opt' + (o.value === value ? ' is-active' : '')}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function DonateView(props: DonateViewProps) {
  const { brandName, logoUrl, goals, supporters, totalRaisedRub, supportersCount, weekCount, userName, subscribeHref } = props

  const [amount, setAmount] = useState<number>(1000)
  const [custom, setCustom] = useState('')
  const [goalId, setGoalId] = useState<string>('')
  const [message, setMessage] = useState('')
  const [anon, setAnon] = useState(false)
  const [name, setName] = useState(userName || '')
  const [modal, setModal] = useState(false)

  const effAmount = custom.trim() ? Math.max(0, Math.floor(Number(custom.replace(/\D/g, '')) || 0)) : amount

  const withMessages = useMemo(() => supporters.filter((s) => !s.isAnonymous && s.message.trim()), [supporters])
  const topSupporters = useMemo(() => [...supporters].sort((a, b) => b.amountRub - a.amountRub).slice(0, 5), [supporters])

  function pickGoal(id: string | number) {
    setGoalId(String(id))
    document.getElementById('dn-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (effAmount <= 0) return
    setModal(true)
  }

  return (
    <main style={{ background: 'var(--brand-bg)', minHeight: '100vh' }}>
      <div className="dn-wrap">
        <nav className="dn-crumbs">
          <Link href="/" className="c-navlink">Главная</Link>
          <span aria-hidden>/</span>
          <span style={{ color: 'var(--brand-text)' }}>Поддержать проект</span>
        </nav>

        {/* HERO */}
        <header className="dn-hero">
          <div className="dn-hero__body">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={brandName} className="dn-hero__logo" />
            )}
            <span className="dn-eyebrow"><Heart size={14} /> Поддержать проект</span>
            <h1 className="dn-hero__title">Помогите {brandName || 'проекту'} расти</h1>
            <p className="dn-hero__sub">
              Проект живёт благодаря зрителям. Разовая поддержка идёт напрямую на озвучку,
              оборудование и новые выпуски. Любая сумма — уже вклад.
            </p>
            <div className="dn-stats">
              <div className="dn-stat"><div className="dn-stat__n">{rub(totalRaisedRub)}</div><div className="dn-stat__l">собрано всего</div></div>
              <div className="dn-stat"><div className="dn-stat__n">{fmt(supportersCount)}</div><div className="dn-stat__l">поддержали</div></div>
              <div className="dn-stat"><div className="dn-stat__n">{goals.length}</div><div className="dn-stat__l">активных целей</div></div>
            </div>
            <a href="#dn-form" className="dn-btn dn-btn--primary dn-btn--lg"><Heart size={18} /> Поддержать</a>
            {weekCount > 0 && (
              <p className="dn-hero__live"><Sparkles size={14} /> {weekCount} чел. поддержали за последнюю неделю</p>
            )}
          </div>
        </header>

        {/* GOALS */}
        {goals.length > 0 && (
          <section className="dn-section">
            <h2 className="dn-h2">Цели сбора</h2>
            <div className="dn-goals">
              {goals.map((g) => {
                const pct = g.targetRub > 0 ? Math.min(100, Math.round((g.raisedRub / g.targetRub) * 100)) : 0
                const left = Math.max(0, g.targetRub - g.raisedRub)
                return (
                  <div key={g.id} className="dn-goal">
                    <div className="dn-goal__top">
                      <div className="dn-goal__sum">{rub(g.raisedRub)} <span>из {rub(g.targetRub)}</span></div>
                      <div className="dn-goal__pct">{pct}%</div>
                    </div>
                    <div className="dn-bar"><span style={{ width: `${pct}%` }} /></div>
                    {g.title && <div className="dn-goal__title">{g.title}</div>}
                    {g.description && <p className="dn-goal__desc">{g.description}</p>}
                    <div className="dn-goal__foot">
                      <span className="dn-goal__left">осталось {rub(left)}</span>
                      <button className="dn-btn dn-btn--primary" onClick={() => pickGoal(g.id)}><Heart size={16} /> Поддержать</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* FORM + SIDE */}
        <section className="dn-section dn-grid" id="dn-form">
          <form className="dn-card dn-form" onSubmit={submit}>
            <h2 className="dn-h2">Поддержать разово</h2>
            <label className="dn-label">Сумма</label>
            <div className="dn-presets">
              {PRESETS.map((p) => (
                <button type="button" key={p} className={'dn-chip' + (!custom && amount === p ? ' is-active' : '')} onClick={() => { setAmount(p); setCustom('') }}>
                  <span className="dn-chip__n">{fmt(p)} ₽</span>
                  <span className="dn-chip__h">{PRESET_HINT[p]}</span>
                </button>
              ))}
            </div>
            <div className="dn-custom">
              <input inputMode="numeric" className="dn-input" placeholder="Своя сумма, ₽" value={custom} onChange={(e) => setCustom(e.target.value)} />
            </div>

            <label className="dn-label">Куда направить</label>
            <GoalSelect
              value={goalId}
              onChange={setGoalId}
              options={[{ value: '', label: 'На проект в целом' }, ...goals.map((g) => ({ value: String(g.id), label: g.title }))]}
            />

            <label className="dn-label">Слова поддержки (необязательно)</label>
            <textarea className="dn-input" rows={3} placeholder="Спасибо за вашу работу!" value={message} onChange={(e) => setMessage(e.target.value)} />

            <label className="dn-label">Как вас показать</label>
            <input className="dn-input" placeholder="Ваше имя" value={name} disabled={anon} onChange={(e) => setName(e.target.value)} />
            <label className="dn-check">
              <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
              <span>Поддержать анонимно</span>
            </label>

            <button type="submit" className="dn-btn dn-btn--primary dn-btn--lg dn-btn--block" disabled={effAmount <= 0}>
              <Heart size={18} /> Поддержать на {rub(effAmount)}
            </button>
            <p className="dn-trust"><Shield size={14} /> Оплата картами РФ и СБП, безопасно через YooKassa</p>
          </form>

          <aside className="dn-side">
            <div className="dn-card dn-top">
              <h3 className="dn-h3"><TrendingUp size={16} /> Топ поддержки</h3>
              {topSupporters.length === 0 ? <p className="dn-muted">Пока никого — станьте первым!</p> : (
                <ol className="dn-toplist">
                  {topSupporters.map((s, i) => (
                    <li key={s.id}><span className="dn-rank">{i + 1}</span><span className="dn-top__name">{s.isAnonymous ? 'Аноним' : s.name}</span><span className="dn-top__sum">{rub(s.amountRub)}</span></li>
                  ))}
                </ol>
              )}
            </div>
            <div className="dn-card dn-why">
              <h3 className="dn-h3"><Users size={16} /> Другой способ помочь</h3>
              <p className="dn-muted">Оформите подписку — регулярная поддержка и доступ к эксклюзиву.</p>
              <Link href={subscribeHref} className="dn-btn dn-btn--ghost dn-btn--block">Смотреть подписки</Link>
              <Link href="/gift" className="dn-btn dn-btn--ghost dn-btn--block" style={{ marginTop: '.6rem' }}>🎁 Подарить подписку</Link>
            </div>
          </aside>
        </section>

        {/* WORDS OF SUPPORT */}
        {withMessages.length > 0 && (
          <section className="dn-section">
            <h2 className="dn-h2">Слова поддержки</h2>
            <div className="dn-msgs">
              {withMessages.slice(0, 9).map((s) => (
                <figure key={s.id} className="dn-msg">
                  <div className="dn-msg__head">
                    <span className="dn-ava">{(s.name || '?').slice(0, 1).toUpperCase()}</span>
                    <div className="dn-msg__name">{s.name}</div>
                    <span className="dn-msg__date">{s.dateLabel}</span>
                  </div>
                  <blockquote className="dn-msg__text">{s.message}</blockquote>
                  <figcaption className="dn-msg__foot">
                    {s.goalTitle && <span className="dn-msg__goal">на: {s.goalTitle}</span>}
                    <span className="dn-msg__sum">{rub(s.amountRub)}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

      </div>

      {modal && (
        <div className="dn-modal" role="dialog" aria-modal="true" onClick={() => setModal(false)}>
          <div className="dn-modal__box" onClick={(e) => e.stopPropagation()}>
            <button className="dn-modal__x" onClick={() => setModal(false)} aria-label="Закрыть"><X size={18} /></button>
            <span className="dn-ava dn-ava--lg"><Heart size={26} /></span>
            <h3 className="dn-modal__title">Спасибо, что хотите поддержать!</h3>
            <p className="dn-modal__text">
              Приём оплат через YooKassa сейчас подключается — совсем скоро вы сможете
              перевести {rub(effAmount)}{goalId ? ' на выбранную цель' : ''}. Загляните чуть позже 💛
            </p>
            <button className="dn-btn dn-btn--primary dn-btn--block" onClick={() => setModal(false)}>Понятно</button>
          </div>
        </div>
      )}
    </main>
  )
}
