'use client'
import React from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'

export type ProfileData = {
  eyebrow?: string
  subtitle?: string
  lead?: string
  quickFacts?: { label: string; value: string }[]
  sections?: { title: string; body: string }[]
  timeline?: { year: string; title: string; text?: string }[]
  relations?: { name: string; text: string }[]
  releases?: { title: string; meta?: string; year?: string }[]
  films?: { title: string; meta?: string; year?: string }[]
  awards?: { title: string; subtitle?: string; icon?: string }[]
  facts?: string[]
}

type Col = { key: string; label: string; textarea?: boolean; ph?: string; w?: number }

const rowBtn: React.CSSProperties = { border: '1px solid var(--st-border)', background: 'var(--st-surface)', color: 'var(--st-text-muted)', borderRadius: 8, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }

function ArrayEditor({ title, items, cols, blank, onChange }: {
  title: string
  items: any[]
  cols: Col[]
  blank: () => any
  onChange: (next: any[]) => void
}) {
  const list = Array.isArray(items) ? items : []
  const upd = (i: number, key: string, val: string) => { const n = list.map((r, j) => j === i ? { ...r, [key]: val } : r); onChange(n) }
  const add = () => onChange([...list, blank()])
  const del = (i: number) => onChange(list.filter((_, j) => j !== i))
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= list.length) return; const n = [...list]; const t = n[i]; n[i] = n[j]; n[j] = t; onChange(n) }
  return (
    <details className="pe__block">
      <summary><span>{title}</span><em>{list.length}</em></summary>
      <div className="pe__rows">
        {list.map((r, i) => (
          <div className="pe__row" key={i}>
            <div className="pe__fields">
              {cols.map((c) => c.textarea ? (
                <textarea key={c.key} className="studio-input pe__ta" rows={3} placeholder={c.ph || c.label} value={r[c.key] ?? ''} onChange={(e) => upd(i, c.key, e.target.value)} />
              ) : (
                <input key={c.key} className="studio-input" style={{ flex: c.w || 1, minWidth: 90 }} placeholder={c.ph || c.label} value={r[c.key] ?? ''} onChange={(e) => upd(i, c.key, e.target.value)} />
              ))}
            </div>
            <div className="pe__ctrls">
              <button type="button" style={rowBtn} onClick={() => move(i, -1)} title="Выше"><ChevronUp size={15} /></button>
              <button type="button" style={rowBtn} onClick={() => move(i, 1)} title="Ниже"><ChevronDown size={15} /></button>
              <button type="button" style={{ ...rowBtn, color: '#e5484d' }} onClick={() => del(i)} title="Удалить"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
        <button type="button" className="studio-btn studio-btn--ghost pe__add" onClick={add}><Plus size={15} /> Добавить</button>
      </div>
    </details>
  )
}

function FactsEditor({ items, onChange }: { items: string[]; onChange: (n: string[]) => void }) {
  const list = Array.isArray(items) ? items : []
  const upd = (i: number, v: string) => onChange(list.map((r, j) => j === i ? v : r))
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= list.length) return; const n = [...list]; const t = n[i]; n[i] = n[j]; n[j] = t; onChange(n) }
  return (
    <details className="pe__block">
      <summary><span>Интересные факты</span><em>{list.length}</em></summary>
      <div className="pe__rows">
        {list.map((r, i) => (
          <div className="pe__row" key={i}>
            <div className="pe__fields"><input className="studio-input" style={{ flex: 1 }} placeholder="Факт" value={r} onChange={(e) => upd(i, e.target.value)} /></div>
            <div className="pe__ctrls">
              <button type="button" style={rowBtn} onClick={() => move(i, -1)} title="Выше"><ChevronUp size={15} /></button>
              <button type="button" style={rowBtn} onClick={() => move(i, 1)} title="Ниже"><ChevronDown size={15} /></button>
              <button type="button" style={{ ...rowBtn, color: '#e5484d' }} onClick={() => onChange(list.filter((_, j) => j !== i))} title="Удалить"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
        <button type="button" className="studio-btn studio-btn--ghost pe__add" onClick={() => onChange([...list, ''])}><Plus size={15} /> Добавить факт</button>
      </div>
    </details>
  )
}

export function ProfileEditor({ value, onChange }: { value: ProfileData | null; onChange: (v: ProfileData) => void }) {
  const v: ProfileData = value || {}
  const set = (patch: Partial<ProfileData>) => onChange({ ...v, ...patch })
  return (
    <div className="pe">
      <style dangerouslySetInnerHTML={{ __html: PE_CSS }} />
      <div className="pe__hint">Шаблон «Профиль»: заполните блоки-досье. Портрет — это обложка публикации; галерея и видео — в блоке «Медиа» ниже.</div>

      <label className="studio-field"><span className="studio-field__label">Надзаголовок (eyebrow)</span>
        <input className="studio-input" placeholder="Участник BTS · рэп-линия · главный танцор" value={v.eyebrow ?? ''} onChange={(e) => set({ eyebrow: e.target.value })} /></label>
      <label className="studio-field"><span className="studio-field__label">Подзаголовок</span>
        <input className="studio-input" placeholder="Настоящее имя · прозвище" value={v.subtitle ?? ''} onChange={(e) => set({ subtitle: e.target.value })} /></label>
      <label className="studio-field"><span className="studio-field__label">Вступление (lead)</span>
        <textarea className="studio-input pe__ta" rows={3} placeholder="Короткое описание в герое" value={v.lead ?? ''} onChange={(e) => set({ lead: e.target.value })} /></label>

      <ArrayEditor title="Быстрые факты" items={v.quickFacts ?? []} cols={[{ key: 'label', label: 'Метка', w: 1 }, { key: 'value', label: 'Значение', w: 2 }]} blank={() => ({ label: '', value: '' })} onChange={(n) => set({ quickFacts: n })} />
      <ArrayEditor title="Разделы (текст)" items={v.sections ?? []} cols={[{ key: 'title', label: 'Заголовок раздела' }, { key: 'body', label: 'Текст (абзацы через пустую строку)', textarea: true }]} blank={() => ({ title: '', body: '' })} onChange={(n) => set({ sections: n })} />
      <ArrayEditor title="Хронология" items={v.timeline ?? []} cols={[{ key: 'year', label: 'Год', w: 1 }, { key: 'title', label: 'Заголовок', w: 2 }, { key: 'text', label: 'Описание', textarea: true }]} blank={() => ({ year: '', title: '', text: '' })} onChange={(n) => set({ timeline: n })} />
      <ArrayEditor title="Отношения (аккордеон)" items={v.relations ?? []} cols={[{ key: 'name', label: 'Имя' }, { key: 'text', label: 'Описание', textarea: true }]} blank={() => ({ name: '', text: '' })} onChange={(n) => set({ relations: n })} />
      <ArrayEditor title="Дискография" items={v.releases ?? []} cols={[{ key: 'title', label: 'Название', w: 2 }, { key: 'meta', label: 'Тип/подпись', w: 1 }, { key: 'year', label: 'Год', w: 1 }]} blank={() => ({ title: '', meta: '', year: '' })} onChange={(n) => set({ releases: n })} />
      <ArrayEditor title="Фильмография" items={v.films ?? []} cols={[{ key: 'title', label: 'Название', w: 2 }, { key: 'meta', label: 'Тип', w: 1 }, { key: 'year', label: 'Год', w: 1 }]} blank={() => ({ title: '', meta: '', year: '' })} onChange={(n) => set({ films: n })} />
      <ArrayEditor title="Награды" items={v.awards ?? []} cols={[{ key: 'icon', label: 'Эмодзи', w: 1 }, { key: 'title', label: 'Название', w: 2 }, { key: 'subtitle', label: 'Подпись', w: 2 }]} blank={() => ({ icon: '🏆', title: '', subtitle: '' })} onChange={(n) => set({ awards: n })} />
      <FactsEditor items={v.facts ?? []} onChange={(n) => set({ facts: n })} />
    </div>
  )
}

const PE_CSS = `
.pe{margin:6px 0 4px}
.pe__hint{font-size:12.5px;color:var(--st-text-muted);background:color-mix(in srgb,var(--st-accent) 9%,transparent);border:1px solid color-mix(in srgb,var(--st-accent) 22%,transparent);border-radius:12px;padding:10px 14px;margin-bottom:14px;line-height:1.4}
.pe .pe__ta{resize:vertical;min-height:70px;font-family:inherit}
.pe__block{border:1px solid var(--st-border);border-radius:12px;margin-bottom:10px;background:var(--st-surface)}
.pe__block>summary{cursor:pointer;list-style:none;padding:12px 15px;display:flex;align-items:center;justify-content:space-between;font-weight:600;font-size:14px;color:var(--st-text)}
.pe__block>summary::-webkit-details-marker{display:none}
.pe__block>summary em{font-style:normal;font-size:12px;color:var(--st-text-muted);background:color-mix(in srgb,var(--st-text) 8%,transparent);border-radius:999px;padding:2px 9px;font-weight:700}
.pe__block[open]>summary{border-bottom:1px solid var(--st-border)}
.pe__rows{padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.pe__row{display:flex;gap:8px;align-items:flex-start}
.pe__fields{flex:1;display:flex;gap:8px;flex-wrap:wrap}
.pe__ctrls{display:flex;gap:4px;flex:none}
.pe__add{align-self:flex-start;margin-top:2px}
`
