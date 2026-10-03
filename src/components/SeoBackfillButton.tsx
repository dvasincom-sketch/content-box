'use client'
import React from 'react'

/**
 * Кнопка «Сгенерировать описания» на /admin/seo-audit. Идёт страницами по
 * /api/admin/backfill-seo (категории → публикации), показывает прогресс. Работа
 * — на сервере приложения (БД доступна оттуда). dry-run по умолчанию включён.
 */
type Totals = { updated: number; skipped: number; scanned: number }

export default function SeoBackfillButton() {
  const [running, setRunning] = React.useState(false)
  const [dry, setDry] = React.useState(true)
  const [force, setForce] = React.useState(false)
  const [log, setLog] = React.useState<string[]>([])
  const [totals, setTotals] = React.useState<Totals>({ updated: 0, skipped: 0, scanned: 0 })

  const add = (line: string) => setLog((l) => [...l, line])

  async function run() {
    if (running) return
    setRunning(true)
    setLog([])
    const acc: Totals = { updated: 0, skipped: 0, scanned: 0 }
    try {
      for (const collection of ['categories', 'publications'] as const) {
        add(collection === 'categories' ? 'Категории…' : 'Публикации…')
        let page = 1
        let done = false
        let guard = 0
        while (!done && guard++ < 1000) {
          const r = await fetch('/api/admin/backfill-seo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ collection, page, dry, force }),
          })
          const j = await r.json().catch(() => null)
          if (!r.ok || !j?.ok) {
            add(`  ✗ ошибка (стр. ${page}): ${j?.error || r.status}`)
            break
          }
          acc.updated += j.updated
          acc.skipped += j.skipped
          acc.scanned += j.scanned
          setTotals({ ...acc })
          add(`  стр. ${j.page}/${j.totalPages}: обновлено ${j.updated}, пропущено ${j.skipped}`)
          done = j.done
          page = j.page + 1
        }
      }
      add('')
      add(`Готово. Обновлено: ${acc.updated}, пропущено: ${acc.skipped}.${dry ? ' (dry-run — БД не менялась)' : ''}`)
    } catch (e) {
      add(`Сбой: ${(e as Error).message}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div
      style={{
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 6,
        padding: '14px 16px',
        marginBottom: 24,
        background: 'var(--theme-elevation-50)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Сгенерировать SEO-описания из контекста</div>
      <p style={{ margin: '0 0 10px', fontSize: 13, opacity: 0.75 }}>
        Заполняет пустые SEO-описания у категорий и публикаций: берётся текст тела, иначе собирается из
        заголовка, раздела, ключевых запросов и бренда. Уже заполненные вручную описания не трогаются
        (если не включён «перезаписать»). Выполняется на сервере.
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={dry} disabled={running} onChange={(e) => setDry(e.target.checked)} />
          Только показать (dry-run)
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={force} disabled={running} onChange={(e) => setForce(e.target.checked)} />
          Перезаписать заполненные
        </label>
        <button
          type="button"
          onClick={run}
          disabled={running}
          style={{
            padding: '8px 16px',
            borderRadius: 4,
            border: 'none',
            cursor: running ? 'default' : 'pointer',
            fontWeight: 600,
            fontSize: 13,
            color: '#fff',
            background: running ? 'var(--theme-elevation-400)' : 'var(--theme-success-500, #2a9d4a)',
          }}
        >
          {running ? 'Выполняется…' : dry ? 'Показать (dry-run)' : 'Заполнить описания'}
        </button>
        {(totals.updated > 0 || totals.skipped > 0) && (
          <span style={{ fontSize: 13, opacity: 0.8 }}>
            обновлено {totals.updated} · пропущено {totals.skipped}
          </span>
        )}
      </div>
      {log.length > 0 && (
        <pre
          style={{
            margin: 0,
            maxHeight: 220,
            overflow: 'auto',
            fontSize: 12,
            lineHeight: 1.5,
            background: 'var(--theme-elevation-100)',
            borderRadius: 4,
            padding: '8px 10px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {log.join('\n')}
        </pre>
      )}
    </div>
  )
}
