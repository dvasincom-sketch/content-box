'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './search.module.css'
import { highlight } from './highlight'

type Hit = {
  id: string
  type: string
  url: string
  thumb: string | null
  minTier: number
  locked: boolean
  title: string
}

const TYPE_LABELS: Record<string, string> = {
  publication: 'Публикация',
  category: 'Категория',
  video: 'Видео',
  page: 'Страница',
}

export function SearchBox({
  initialQuery = '',
  initialIncludeLocked = true,
  showLockedToggle = true,
}: {
  initialQuery?: string
  initialIncludeLocked?: boolean
  showLockedToggle?: boolean
}) {
  const router = useRouter()
  const [q, setQ] = useState(initialQuery)
  const [includeLocked, setIncludeLocked] = useState(initialIncludeLocked)
  const [hits, setHits] = useState<Hit[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1) // индекс подсветки для клавиатуры
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced typeahead
  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) {
      setHits([])
      setOpen(false)
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query })
        if (!includeLocked) params.set('locked', '0')
        const res = await fetch(`/api/search/suggest?${params.toString()}`, {
          signal: ctrl.signal,
        })
        const data = await res.json()
        setHits(data.hits ?? [])
        setActive(-1)
        setOpen(true)
      } catch {
        /* aborted or network error — ignore */
      }
    }, 180)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q, includeLocked])

  // Close dropdown on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const goToSearch = () => {
    const query = q.trim()
    if (!query) return
    const params = new URLSearchParams({ q: query })
    if (!includeLocked) params.set('locked', '0')
    setOpen(false)
    router.push(`/search?${params.toString()}`)
  }

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    goToSearch()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open || hits.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, -1))
    } else if (e.key === 'Enter' && active >= 0) {
      const h = hits[active]
      if (h && !h.locked) {
        e.preventDefault()
        setOpen(false)
        router.push(h.url)
      }
    }
  }

  const clear = () => {
    setQ('')
    setHits([])
    setOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className={styles.box} ref={boxRef}>
      <form onSubmit={submit} className={styles.form} role="search">
        <span className={styles.inputWrap}>
          <svg
            className={styles.searchIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            className={styles.input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => hits.length > 0 && setOpen(true)}
            placeholder="Поиск по сайту…"
            aria-label="Поиск по сайту"
            autoComplete="off"
          />
          {q && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={clear}
              aria-label="Очистить"
            >
              ×
            </button>
          )}
        </span>
        <button type="submit" className={`${styles.submit} c-spotlight c-spotlight-bright`}>
          Найти
        </button>
      </form>

      {showLockedToggle && (
        <label className={styles.toggle}>
          <input
            type="checkbox"
            className={styles.toggleInput}
            checked={includeLocked}
            onChange={(e) => setIncludeLocked(e.target.checked)}
          />
          <span className={styles.toggleTrack}>
            <span className={styles.toggleKnob} />
          </span>
          <span className={styles.toggleLabel}>Искать в закрытом контенте</span>
        </label>
      )}

      {open && hits.length > 0 && (
        <ul className={styles.dropdown} role="listbox">
          {hits.map((h, i) => (
            <li key={h.id} role="option" aria-selected={i === active}>
              <Link
                href={h.locked ? '#' : h.url}
                className={`${styles.suggest} c-spotlight ${i === active ? styles.suggestActive : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => setOpen(false)}
              >
                {h.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.thumb} alt="" className={styles.suggestThumb} />
                ) : (
                  <span className={styles.suggestThumbPlaceholder} aria-hidden />
                )}
                <span className={styles.suggestBody}>
                  <span
                    className={styles.suggestTitle}
                    dangerouslySetInnerHTML={{ __html: highlight(h.title) }}
                  />
                  <span className={styles.suggestType}>
                    {TYPE_LABELS[h.type] ?? h.type}
                    {h.locked ? ' · 🔒' : ''}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          <li>
            <button type="button" className={styles.showAll} onClick={goToSearch}>
              Показать все результаты «{q.trim()}»
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
