"use client"

import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const current = document.documentElement.classList.contains('theme-light') ? 'light' : 'dark'
    setTheme(current)
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-light')
    root.classList.add('theme-' + next)
    root.style.colorScheme = next
    try { localStorage.setItem('theme', next) } catch { /* приватный режим — тема не запомнится */ }
    setTheme(next)
  }

  const label = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'
  return (
    <span className="c-tooltip-wrap">
      <button
        type="button"
        aria-label={label}
        onClick={toggle}
        className="c-btn c-btn--surface c-btn--icon c-spotlight"
      >
        {mounted && theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <span className="c-tooltip c-tooltip--below" role="tooltip">{label}</span>
    </span>
  )
}
