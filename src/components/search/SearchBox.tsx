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
  'gallery-image': 'Фото',
  video: 'Видео',
  page: 'Страница',
}

export function SearchBox({
  initialQuery = '',
  initialIncludeLocked = true,
}: {
  initialQuery?: string
  initialIncludeLocked?: boolean
}) {
  const router = useRouter()
  const [q, setQ] = useState(initialQuery)
  const [includeLocked, setIncludeLocked] = useState(initialIncludeLocked)
  const [hits, setHits] = useState<Hit[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

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

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const query = q.trim()
    if (!query) return
    const params = new URLSearchParams({ q: query })
    if (!includeLocked) params.set('locked', '0')
    setOpen(false)
    router.push(`/search?${params.toString()}`)
  }

  return (
    <div className={styles.box} ref={boxRef}>
      <form onSubmit={submit} className={styles.form} role="search">
        <input
          className={styles.input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder="Поиск по сайту…"
          aria-label="Поиск по сайту"
          autoComplete="off"
        />
        <button type="submit" className={styles.submit}>
          Найти
        </button>
      </form>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={includeLocked}
          onChange={(e) => setIncludeLocked(e.target.checked)}
        />
        Искать в закрытом контенте
      </label>

      {open && hits.length > 0 && (
        <ul className={styles.dropdown}>
          {hits.map((h) => (
            <li key={h.id}>
              <Link
                href={h.locked ? '#' : h.url}
                className={styles.suggest}
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
        </ul>
      )}
    </div>
  )
}
