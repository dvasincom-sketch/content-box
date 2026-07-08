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
    try { localStorage.setItem('theme', next) } catch (e) {}
    setTheme(next)
  }

  return (
    <button
      type="button"
      aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      onClick={toggle}
      className="inline-flex items-center justify-center h-10 w-10 rounded-lg transition-colors"
      style={{
        color: 'var(--brand-text)',
        background: 'color-mix(in srgb, var(--brand-surface) 60%, transparent)',
      }}
    >
      {mounted && theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
