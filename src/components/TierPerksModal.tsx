'use client'

import React, { useState } from 'react'
import { Check, X, ChevronRight } from 'lucide-react'

/**
 * Компактная плашка тарифа не показывает список преимуществ — по кнопке
 * «Что входит» открываем модалку со списком для этого уровня. Плашки остаются
 * маленькими, но пользователь может узнать состав подписки.
 */
export function TierPerksModal({ name, perks, price }: { name: string; perks: string[]; price?: number | null }) {
  const [open, setOpen] = useState(false)
  const items = (perks || []).filter((p) => typeof p === 'string' && p.trim().length > 0)
  if (items.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, background: 'none', border: 'none',
          color: 'var(--brand-primary, #e86a33)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', padding: 0,
        }}
      >
        Что входит <ChevronRight size={15} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Что входит в «${name}»`}
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(20,14,25,.4)', backdropFilter: 'blur(2px)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 420, background: 'var(--brand-surface, #fff)', borderRadius: 18,
              boxShadow: '0 24px 60px -20px rgba(0,0,0,.5)', overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid var(--brand-border, rgba(0,0,0,.08))' }}>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--brand-text)' }}>{name}</div>
                {price != null && price > 0 && (
                  <div style={{ fontSize: 13, color: 'var(--brand-muted)' }}>{new Intl.NumberFormat('ru-RU').format(price)} ₽/мес</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                style={{ marginLeft: 'auto', width: 34, height: 34, border: 'none', background: 'transparent', color: 'var(--brand-muted)', borderRadius: 9, cursor: 'pointer', display: 'grid', placeItems: 'center' }}
              >
                <X size={18} />
              </button>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map((perk, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--brand-text)', fontSize: 14, lineHeight: 1.45 }}>
                  <span style={{ flexShrink: 0, marginTop: 1, display: 'inline-grid', placeItems: 'center', width: 20, height: 20, borderRadius: '50%', background: 'color-mix(in srgb, var(--brand-primary) 14%, transparent)', color: 'var(--brand-primary, #e86a33)' }}>
                    <Check size={13} />
                  </span>
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
