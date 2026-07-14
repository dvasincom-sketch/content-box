'use client'

import React, { useState } from 'react'

/**
 * Аккордеон для раздела «Помощь». Клиентский — раскрытие/сворачивание.
 * Стиль согласован с рестайлом админки (светлый, фиолетовый акцент #7c3aed).
 */
export function HelpAccordion({
  sections,
}: {
  sections: { id: string; title: string; body: React.ReactNode }[]
}) {
  const [open, setOpen] = useState<string | null>(sections[0]?.id ?? null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sections.map((s) => {
        const isOpen = open === s.id
        return (
          <div
            key={s.id}
            style={{
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: 12,
              overflow: 'hidden',
              background: 'var(--theme-elevation-100)',
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : s.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: isOpen ? 'color-mix(in srgb, #7c3aed 6%, transparent)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--theme-text)',
                textAlign: 'left',
              }}
            >
              <span>{s.title}</span>
              <span
                style={{
                  display: 'inline-flex',
                  transform: isOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s',
                  color: '#7c3aed',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </button>
            {isOpen && (
              <div
                style={{
                  padding: '4px 20px 20px',
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: 'var(--theme-text)',
                }}
              >
                {s.body}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
