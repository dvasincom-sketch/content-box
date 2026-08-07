'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Check } from 'lucide-react'
import {
  ENTITY_GROUPS, CONTENT_ACTIONS, ASSIGNABLE_PRESETS, PRESETS, PRESET_LABELS, PRESET_HINTS,
  matchPreset, type CapMatrix, type ContentAction,
} from '@/lib/permissions'
import type { Member } from './SettingsView'

const clone = (m: CapMatrix): CapMatrix => JSON.parse(JSON.stringify(m || {}))

/**
 * Редактор прав участника: выбор роли-пресета + тонкая матрица (сущность×действие).
 * Сохраняет studioRole + capabilities (роут access/permissions).
 */
export function PermissionsModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const initialRole =
    (member.studioRole && member.studioRole !== '' && member.studioRole !== 'owner' && member.studioRole)
    || (member.capabilities ? matchPreset(member.capabilities) : 'author')
  const initialCaps =
    member.capabilities && Object.keys(member.capabilities).length
      ? clone(member.capabilities)
      : clone(PRESETS[initialRole] ?? PRESETS.author)

  const [role, setRole] = useState<string>(initialRole)
  const [caps, setCaps] = useState<CapMatrix>(initialCaps)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  function applyPreset(r: string) {
    setRole(r)
    setCaps(clone(PRESETS[r] ?? {}))
  }
  function getCap(entity: keyof CapMatrix, action: string): boolean {
    const node = caps[entity] as Record<string, boolean> | undefined
    return Boolean(node && node[action])
  }
  function setCap(entity: keyof CapMatrix, action: string, val: boolean) {
    setCaps((prev) => {
      const next = clone(prev)
      const node = { ...(next[entity] as Record<string, boolean> | undefined) }
      if (val) node[action] = true
      else delete node[action]
      ;(next as Record<string, unknown>)[entity] = node
      return next
    })
    setRole('custom')
  }

  async function save() {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/studio/api/access/permissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ userId: member.id, studioRole: role, capabilities: caps }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Не удалось сохранить'); setBusy(false); return }
      onClose()
      // обновление списка — родитель дергает router.refresh через onClose-обёртку
    } catch { setError('Ошибка соединения'); setBusy(false) }
  }

  const panel = (
    <div className="studio-portal">
      <div className="catedit__overlay" onClick={onClose}>
        <div className="catedit perm" onClick={(e) => e.stopPropagation()}>
          <div className="catedit__head">
            <h3>Права: {member.name || member.email}</h3>
            <button className="catmgr__icon-btn" onClick={onClose} title="Закрыть"><X size={18} /></button>
          </div>

          <div className="catedit__body">
            <div className="perm__roles">
              <span className="perm__roles-label">Роль:</span>
              {ASSIGNABLE_PRESETS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={'perm__role' + (role === r ? ' is-active' : '')}
                  title={PRESET_HINTS[r]}
                  onClick={() => applyPreset(r)}
                >
                  {PRESET_LABELS[r]}
                </button>
              ))}
              {role === 'custom' && <span className="perm__role perm__role--custom is-active">Своя настройка</span>}
            </div>
            <p className="perm__hint">{PRESET_HINTS[role] || 'Права заданы вручную'}</p>

            {ENTITY_GROUPS.map((g) => (
              <div key={g.title} className="perm__group">
                <div className="perm__group-title">{g.title}</div>

                {/* Контентные строки — таблица действий */}
                {g.items.some((i) => i.kind === 'content') && (
                  <div className="perm__table">
                    <div className="perm__thead">
                      <span />
                      {CONTENT_ACTIONS.map((a) => <span key={a.key} className="perm__col">{a.label}</span>)}
                    </div>
                    {g.items.filter((i) => i.kind === 'content').map((it) => (
                      <div key={it.key} className="perm__trow">
                        <span className="perm__ent">{it.label}</span>
                        {CONTENT_ACTIONS.map((a) => (
                          <label key={a.key} className="perm__cell">
                            <input
                              className="perm-check" type="checkbox"
                              checked={getCap(it.key, a.key as ContentAction)}
                              onChange={(e) => setCap(it.key, a.key, e.target.checked)}
                            />
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Manage / moderate — одиночные тумблеры */}
                {g.items.filter((i) => i.kind !== 'content').map((it) => {
                  const action = it.kind === 'moderate' ? 'moderate' : it.kind === 'view' ? 'view' : 'manage'
                  const actionLabel = it.kind === 'moderate' ? 'Модерировать' : it.kind === 'view' ? 'Показывать' : 'Управлять'
                  return (
                    <label key={it.key} className="perm__single">
                      <span className="perm__ent">{it.label}</span>
                      <span className="perm__single-right">
                        <span className="perm__single-act">{actionLabel}</span>
                        <input
                          className="perm-check" type="checkbox"
                          checked={getCap(it.key, action)}
                          onChange={(e) => setCap(it.key, action, e.target.checked)}
                        />
                      </span>
                    </label>
                  )
                })}
              </div>
            ))}

            {error && <div className="settings__err">{error}</div>}
          </div>

          <div className="catedit__foot">
            <button className="studio-btn studio-btn--ghost" onClick={onClose} disabled={busy}>Отмена</button>
            <button className="studio-btn studio-btn--primary" onClick={save} disabled={busy}>
              {busy ? <><Loader2 size={15} className="spin" /> Сохранение…</> : <><Check size={15} /> Сохранить права</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(panel, document.body)
}
