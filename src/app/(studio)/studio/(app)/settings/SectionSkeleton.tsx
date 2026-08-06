import React from 'react'
import type { SectionPreview } from '@/lib/homeSectionCatalog'

/**
 * Скелет-превью секции для библиотеки: миниатюра раскладки без реальных данных.
 * Архетип задаётся `kind` (SectionPreview). Использует нейтральные скелет-
 * примитивы (.skel-*) на токенах студии, поэтому корректен в любой теме.
 *
 * Это НЕ реальный рендер секции — только форма/ритм блока, чтобы владелец узнал
 * секцию «в лицо» перед добавлением.
 */

const line = (w: string, key?: React.Key) => (
  <div key={key} className="skel-line" style={{ width: w }} />
)
const lines = (n: number) =>
  Array.from({ length: n }, (_, i) => line(['90%', '70%', '80%'][i % 3], i))

function Poster() {
  return <div className="skel-poster" style={{ aspectRatio: '2 / 3' }} />
}

export function SectionSkeleton({ kind }: { kind: SectionPreview }) {
  switch (kind) {
    case 'hero':
      return (
        <div className="skel skel-col">
          <div className="skel-b skel-b--a" style={{ flex: 2 }} />
          {line('60%')}
          {line('40%')}
        </div>
      )
    case 'spotlight':
      return (
        <div className="skel skel-row" style={{ height: '100%', gap: 10, alignItems: 'stretch' }}>
          <div style={{ flex: 1 }}>
            <div className="skel-row">
              <div className="skel-circle" style={{ width: 30, height: 30 }} />
              <div className="skel-col" style={{ flex: 1 }}>{lines(2)}</div>
            </div>
          </div>
          <div className="skel-row" style={{ flex: 1.4, gap: 6, alignItems: 'stretch' }}>
            <div className="skel-tile" style={{ flex: 1 }} />
            <div className="skel-tile" style={{ flex: 1 }} />
            <div className="skel-tile" style={{ flex: 1 }} />
          </div>
        </div>
      )
    case 'avatars':
      return (
        <div
          className="skel skel-row"
          style={{ justifyContent: 'center', gap: 10, height: '100%' }}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skel-circle" style={{ width: 34, height: 34, flex: 'none' }} />
          ))}
        </div>
      )
    case 'rowcards':
      return (
        <div className="skel skel-col">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skel-row" style={{ flex: 1 }}>
              <div className="skel-b" style={{ width: 26, height: '100%' }} />
              <div style={{ flex: 1 }}>
                {line('70%')}
                <div className="skel-prog" style={{ marginTop: 5 }}>
                  <i style={{ width: '45%' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )
    case 'posters':
      return (
        <div className="skel skel-row" style={{ gap: 6, alignItems: 'stretch' }}>
          <Poster />
          <Poster />
          <Poster />
          <Poster />
        </div>
      )
    case 'grid':
      return (
        <div
          className="skel"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: '1fr 1fr',
            gap: 6,
            height: '100%',
          }}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skel-tile" />
          ))}
        </div>
      )
    case 'listcards':
      return (
        <div className="skel skel-col">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skel-row" style={{ flex: 1 }}>
              <div className="skel-b" style={{ width: 34, height: '100%' }} />
              <div className="skel-col" style={{ flex: 1 }}>{lines(2)}</div>
            </div>
          ))}
        </div>
      )
    case 'chart':
      return (
        <div className="skel skel-col">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skel-row" style={{ flex: 1 }}>
              <span className="skel-rank" />
              <div className="skel-b" style={{ width: 22, height: '100%' }} />
              <div style={{ flex: 1 }}>{line(`${80 - i * 10}%`)}</div>
            </div>
          ))}
        </div>
      )
    case 'banner':
      return (
        <div className="skel skel-col" style={{ justifyContent: 'center' }}>
          <div
            className="skel-b skel-b--a"
            style={{ height: 44, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 8 }}
          >
            <span className="skel-dot" />
            <div className="skel-line" style={{ width: '50%', background: 'rgba(255,255,255,.55)' }} />
          </div>
        </div>
      )
    case 'search':
      return (
        <div className="skel skel-col" style={{ gap: 8 }}>
          <div className="skel-b" style={{ height: 26 }} />
          <div className="skel-row" style={{ gap: 6 }}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skel-pill" style={{ flex: 1 }} />
            ))}
          </div>
        </div>
      )
    case 'chips':
      return (
        <div
          className="skel skel-row"
          style={{ flexWrap: 'wrap', gap: 8, alignContent: 'center', height: '100%' }}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skel-pill" style={{ width: `${28 + (i % 3) * 12}%` }} />
          ))}
        </div>
      )
    case 'features':
      return (
        <div className="skel skel-row" style={{ gap: 6, alignItems: 'stretch' }}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skel-col" style={{ flex: 1 }}>
              <div className="skel-circle" style={{ width: 22, height: 22 }} />
              {lines(2)}
            </div>
          ))}
        </div>
      )
    case 'faq':
      return (
        <div className="skel skel-col" style={{ gap: 7 }}>
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="skel-row"
              style={{
                justifyContent: 'space-between',
                background: 'var(--sk)',
                borderRadius: 6,
                padding: '7px 9px',
              }}
            >
              <div className="skel-line" style={{ width: '60%' }} />
              <div className="skel-line" style={{ width: 10 }} />
            </div>
          ))}
        </div>
      )
    case 'quotes':
      return (
        <div className="skel skel-row" style={{ gap: 6, alignItems: 'stretch' }}>
          {Array.from({ length: 2 }, (_, i) => (
            <div
              key={i}
              className="skel-col"
              style={{ flex: 1, border: '1px solid var(--st-border)', borderRadius: 8, padding: 8, gap: 6 }}
            >
              <div className="skel-b skel-b--a" style={{ width: 14, height: 14 }} />
              {lines(3)}
            </div>
          ))}
        </div>
      )
    case 'tiers':
      return (
        <div className="skel skel-row" style={{ gap: 6, alignItems: 'stretch' }}>
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="skel-col"
              style={{
                flex: 1,
                border: `1px solid ${i === 1 ? 'var(--st-border-strong)' : 'var(--st-border)'}`,
                borderRadius: 8,
                padding: 8,
                gap: 6,
              }}
            >
              {line('70%')}
              <div className="skel-b skel-b--a" style={{ width: '45%', height: 10 }} />
              <div
                className="skel-prog"
                style={{ marginTop: 'auto', height: 16, background: 'var(--sk2)' }}
              />
            </div>
          ))}
        </div>
      )
    case 'rows':
      return (
        <div className="skel skel-col">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skel-row" style={{ flex: 1 }}>
              <div className="skel-circle" style={{ width: 18, height: 18 }} />
              <div className="skel-col" style={{ flex: 1 }}>{lines(2)}</div>
            </div>
          ))}
        </div>
      )
    case 'progress':
      return (
        <div className="skel skel-col" style={{ justifyContent: 'center', gap: 10 }}>
          {line('55%')}
          <div className="skel-prog" style={{ height: 14 }}>
            <i style={{ width: '68%' }} />
          </div>
          {line('30%')}
        </div>
      )
    case 'poll':
      return (
        <div className="skel skel-col" style={{ gap: 7 }}>
          {line('60%')}
          {[70, 45, 30].map((w) => (
            <div key={w} className="skel-prog">
              <i style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      )
    default:
      return <div className="skel skel-col">{lines(3)}</div>
  }
}
