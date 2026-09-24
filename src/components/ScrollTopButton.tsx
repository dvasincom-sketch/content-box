'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'

/**
 * Кнопка «наверх» для длинных страниц. Появляется, когда пользователь
 * прокрутил вниз, по клику плавно возвращает к шапке. Слева снизу — чтобы не
 * пересекаться с виджетом «Спросить Асю» (справа снизу) и плашкой бага (правый
 * край). Стиль — брендовые токены (стеклянная кнопка, как остальные плавающие
 * контролы). Уважает prefers-reduced-motion.
 */
export function ScrollTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setVisible(window.scrollY > 600)
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const toTop = () => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Наверх"
      title="Наверх"
      style={{
        position: 'fixed',
        left: 'max(16px, env(safe-area-inset-left, 0px))',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 22px)',
        zIndex: 39,
        width: 44,
        height: 44,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        border: '1px solid var(--brand-border, rgba(0,0,0,.12))',
        background: 'color-mix(in srgb, var(--brand-surface, #fff) 82%, transparent)',
        color: 'var(--brand-text, #111)',
        boxShadow: '0 12px 30px -12px rgba(0,0,0,.45)',
        cursor: 'pointer',
        WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
        backdropFilter: 'blur(12px) saturate(1.2)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity .2s ease, transform .2s ease, background .15s ease, border-color .15s ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <ArrowUp size={20} strokeWidth={2.4} />
    </button>
  )
}
