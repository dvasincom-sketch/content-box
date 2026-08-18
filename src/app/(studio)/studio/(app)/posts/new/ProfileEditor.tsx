'use client'
import React from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Type, Clock, ListCollapse, Image as ImageIcon, Film, Award, LayoutGrid, Images, Video, Columns3, Quote, GalleryHorizontalEnd, MousePointerClick, Minus, X, Newspaper, Check, Bold, Italic, List, Link2, Heading, PanelTop, Rows3, Info, Sparkles } from 'lucide-react'
import { toBlocks, blankBlock, BLOCK_LABEL, type PBlock, type PBlockType, type PBAward } from '@/lib/profileBlocks'
import { AWARD_ICONS, AWARD_ICON_MAP } from '@/lib/awardIcons'
import { GalleryComposer, type GalleryItem } from './GalleryComposer'
import { VideoAttachPicker, type VideoOption } from './VideoAttachPicker'
import { AiComposeModal } from './AiComposeModal'

export type PEMedia = {
  gallery: GalleryItem[]
  setGallery: (g: GalleryItem[]) => void
  galleryFolders: { id: number | string; title: string; parentId: number | string | null }[]
  videoCandidates: VideoOption[]
  videoIds: (number | string)[]
  setVideoIds: (v: (number | string)[]) => void
  videoModalCats: any
  canCreateMedia?: boolean
  openVideoModal: () => void
  /** id публикации-источника (есть только при редактировании сохранённой). */
  publicationId?: number | string
}

export type { ProfileData } from '@/lib/profileBlocks'
import type { ProfileData } from '@/lib/profileBlocks'

// Порядок и подписи в меню «Добавить блок».
const ADD_MENU: { type: PBlockType; hint: string }[] = [
  { type: 'hero', hint: 'Фото + надзаголовок, подзаголовок, лид' },
  { type: 'facts', hint: 'Карточки «метка → значение»' },
  { type: 'text', hint: 'Заголовок + абзацы и лёгкий редактор' },
  { type: 'timeline', hint: 'Год · заголовок · описание' },
  { type: 'relations', hint: 'Разворачиваемые пункты: заголовок + текст' },
  { type: 'awards', hint: 'Плашки с иконкой (заголовок + подпись)' },
  { type: 'factsList', hint: 'Нумерованные плитки: заголовок + текст' },
  { type: 'gallery', hint: 'Сетка фото (загрузите прямо в блоке)' },
  { type: 'videos', hint: 'Ролики (выберите прямо в блоке)' },
  { type: 'columns', hint: 'Текст в 2–3 колонки' },
  { type: 'callout', hint: 'Выделенная выноска / цитата' },
  { type: 'categoryRow', hint: 'Ряд постеров выбранной категории' },
  { type: 'publications', hint: 'Прикрепить существующие публикации' },
  { type: 'button', hint: 'Кнопка-ссылка (CTA)' },
  { type: 'divider', hint: 'Разделитель / отступ' },
]

const BLOCK_ICON: Record<PBlockType, React.ComponentType<{ size?: number }>> = {
  hero: PanelTop, facts: Rows3,
  text: Type, timeline: Clock, relations: ListCollapse, releases: ImageIcon, films: Film,
  awards: Award, factsList: LayoutGrid, gallery: Images, videos: Video,
  columns: Columns3, callout: Quote, categoryRow: GalleryHorizontalEnd, button: MousePointerClick, divider: Minus, publications: Newspaper,
}
const BlockIcon = ({ type, size = 15 }: { type: PBlockType; size?: number }) => { const I = BLOCK_ICON[type]; return <I size={size} /> }

type Col = { key: string; label: string; textarea?: boolean; ph?: string; w?: number }

const rowBtn: React.CSSProperties = { border: '1px solid var(--st-border)', background: 'var(--st-surface)', color: 'var(--st-text-muted)', borderRadius: 8, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', flex: 'none' }

function newId(): string {
  return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function ArrayEditor({ items, cols, blank, onChange, addLabel }: {
  items: any[]
  cols: Col[]
  blank: () => any
  onChange: (next: any[]) => void
  addLabel?: string
}) {
  const list = Array.isArray(items) ? items : []
  const upd = (i: number, key: string, val: string) => { const n = list.map((r, j) => j === i ? { ...r, [key]: val } : r); onChange(n) }
  const add = () => onChange([...list, blank()])
  const del = (i: number) => onChange(list.filter((_, j) => j !== i))
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= list.length) return; const n = [...list]; const t = n[i]; n[i] = n[j]; n[j] = t; onChange(n) }
  return (
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
      <button type="button" className="studio-btn studio-btn--ghost pe__add" onClick={add}><Plus size={15} /> {addLabel || 'Добавить'}</button>
    </div>
  )
}

function FactsEditor({ items, onChange }: { items: string[]; onChange: (n: string[]) => void }) {
  const list = Array.isArray(items) ? items : []
  const upd = (i: number, v: string) => onChange(list.map((r, j) => j === i ? v : r))
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= list.length) return; const n = [...list]; const t = n[i]; n[i] = n[j]; n[j] = t; onChange(n) }
  return (
    <div className="pe__rows">
      {list.map((r, i) => (
        <div className="pe__row" key={i}>
          <div className="pe__fields"><textarea className="studio-input pe__fact" style={{ flex: 1 }} rows={2} placeholder="Факт" value={r} ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }} onChange={(e) => upd(i, e.target.value)} /></div>
          <div className="pe__ctrls">
            <button type="button" style={rowBtn} onClick={() => move(i, -1)} title="Выше"><ChevronUp size={15} /></button>
            <button type="button" style={rowBtn} onClick={() => move(i, 1)} title="Ниже"><ChevronDown size={15} /></button>
            <button type="button" style={{ ...rowBtn, color: '#e5484d' }} onClick={() => onChange(list.filter((_, j) => j !== i))} title="Удалить"><Trash2 size={15} /></button>
          </div>
        </div>
      ))}
      <button type="button" className="studio-btn studio-btn--ghost pe__add" onClick={() => onChange([...list, ''])}><Plus size={15} /> Добавить факт</button>
    </div>
  )
}

/** Тело блока — зависит от типа. */
function CategoryRowEditor({ categoryId, cats, patch }: { categoryId?: number | string; cats?: { id: number | string; title: string }[]; patch: (p: Partial<PBlock>) => void }) {
  const [preview, setPreview] = React.useState<{ title: string; items: { href: string; title: string; posterUrl?: string | null }[] } | null>(null)
  const [loading, setLoading] = React.useState(false)
  React.useEffect(() => {
    if (!categoryId) { setPreview(null); return }
    let stop = false
    setLoading(true)
    fetch(`/studio/api/category-posters?categoryId=${encodeURIComponent(String(categoryId))}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!stop) setPreview(d && Array.isArray(d.items) ? d : null) })
      .catch(() => { if (!stop) setPreview(null) })
      .finally(() => { if (!stop) setLoading(false) })
    return () => { stop = true }
  }, [categoryId])
  return (
    <div className="pe__rows">
      <select className="studio-input" value={String(categoryId ?? '')} onChange={(e) => patch({ categoryId: e.target.value || undefined } as Partial<PBlock>)}>
        <option value="">— выберите категорию —</option>
        {(cats ?? []).map((c) => <option key={String(c.id)} value={String(c.id)}>{c.title}</option>)}
      </select>
      {loading && <div className="pe__note">Загрузка превью…</div>}
      {!loading && preview && (preview.items.length ? (
        <div className="pe__crowprev">
          {preview.items.slice(0, 8).map((it, i) => (
            <div className="pe__pcardprev" key={i} title={it.title}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="pe__pframe">{it.posterUrl ? <img src={it.posterUrl} alt="" /> : <span>{(it.title || '?').slice(0, 1)}</span>}</div>
              <div className="pe__pttl">{it.title}</div>
            </div>
          ))}
        </div>
      ) : <div className="pe__note">В этой категории пока нет опубликованных публикаций для ряда.</div>)}
      <div className="pe__note">На странице покажется горизонтальный ряд постеров публикаций выбранной категории.</div>
    </div>
  )
}

function IconPicker({ value, onPick, onClose }: { value?: string; onPick: (key: string) => void; onClose: () => void }) {
  const [q, setQ] = React.useState('')
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => { setMounted(true) }, [])
  // Esc закрывает окно.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const nq = q.trim().toLowerCase()
  const list = nq ? AWARD_ICONS.filter((i) => i.label.toLowerCase().includes(nq) || i.key.toLowerCase().includes(nq)) : AWARD_ICONS
  if (!mounted) return null
  // Портал в body — чтобы position:fixed считался от окна, а не от
  // трансформированного родителя (иначе окно «плавает» и обрезается).
  return createPortal(
    (
    <div className="pe__iconov" onMouseDown={onClose}>
      <div className="pe__iconpanel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pe__iconhead">
          <input className="studio-input" autoFocus placeholder="Поиск иконки…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className="pe__iconclose" onClick={onClose} title="Закрыть"><X size={16} /></button>
        </div>
        <div className="pe__icongrid">
          <button type="button" className={'pe__iconcell' + (!value ? ' on' : '')} onClick={() => onPick('')} title="Без иконки"><Minus size={18} /></button>
          {list.map((i) => { const I = i.Comp; return (
            <button type="button" key={i.key} className={'pe__iconcell' + (value === i.key ? ' on' : '')} onClick={() => onPick(i.key)} title={i.label}><I size={18} /></button>
          ) })}
          {!list.length && <div className="pe__note">Ничего не найдено</div>}
        </div>
      </div>
    </div>
    ),
    document.body,
  )
}

function AwardsEditor({ items, onChange }: { items: PBAward[]; onChange: (n: PBAward[]) => void }) {
  const list = Array.isArray(items) ? items : []
  const [pick, setPick] = React.useState<number | null>(null)
  const upd = (i: number, k: string, v: string) => onChange(list.map((r, j) => j === i ? { ...r, [k]: v } : r))
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= list.length) return; const n = [...list]; const t = n[i]; n[i] = n[j]; n[j] = t; onChange(n) }
  const del = (i: number) => onChange(list.filter((_, j) => j !== i))
  return (
    <div className="pe__rows">
      {list.map((r, i) => { const Ic = r.icon ? AWARD_ICON_MAP[r.icon] : null; return (
        <div className="pe__row" key={i}>
          <div className="pe__fields">
            <button type="button" className="pe__iconbtn" onClick={() => setPick(i)} title="Выбрать иконку">{Ic ? <Ic size={18} /> : <span>{r.icon || '★'}</span>}</button>
            <input className="studio-input" style={{ flex: 2, minWidth: 90 }} placeholder="Заголовок" value={r.title ?? ''} onChange={(e) => upd(i, 'title', e.target.value)} />
            <input className="studio-input" style={{ flex: 2, minWidth: 90 }} placeholder="Подпись" value={r.subtitle ?? ''} onChange={(e) => upd(i, 'subtitle', e.target.value)} />
          </div>
          <div className="pe__ctrls">
            <button type="button" style={rowBtn} onClick={() => move(i, -1)} title="Выше"><ChevronUp size={15} /></button>
            <button type="button" style={rowBtn} onClick={() => move(i, 1)} title="Ниже"><ChevronDown size={15} /></button>
            <button type="button" style={{ ...rowBtn, color: '#e5484d' }} onClick={() => del(i)} title="Удалить"><Trash2 size={15} /></button>
          </div>
        </div>
      ) })}
      <button type="button" className="studio-btn studio-btn--ghost pe__add" onClick={() => onChange([...list, { icon: 'Trophy', title: '', subtitle: '' }])}><Plus size={15} /> Добавить</button>
      {pick !== null && <IconPicker value={list[pick]?.icon} onPick={(k) => { upd(pick, 'icon', k); setPick(null) }} onClose={() => setPick(null)} />}
    </div>
  )
}

function PublicationsPicker({ ids, onChange }: { ids: (number | string)[]; onChange: (v: (number | string)[]) => void }) {
  const [q, setQ] = React.useState('')
  const [results, setResults] = React.useState<any[]>([])
  const [selected, setSelected] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(false)
  const idsKey = ids.map(String).join(',')
  React.useEffect(() => {
    if (!ids.length) { setSelected([]); return }
    let stop = false
    fetch(`/studio/api/publications-pick?ids=${encodeURIComponent(idsKey)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!stop && d?.items) { const map = new Map(d.items.map((x: any) => [String(x.id), x])); setSelected(ids.map((id) => map.get(String(id))).filter(Boolean)) } })
      .catch(() => {})
    return () => { stop = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])
  React.useEffect(() => {
    const nq = q.trim()
    if (nq.length < 2) { setResults([]); return }
    let stop = false; setLoading(true)
    const t = setTimeout(() => {
      fetch(`/studio/api/publications-pick?q=${encodeURIComponent(nq)}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (!stop) setResults(d?.items || []) })
        .catch(() => {})
        .finally(() => { if (!stop) setLoading(false) })
    }, 250)
    return () => { stop = true; clearTimeout(t) }
  }, [q])
  const add = (p: any) => { if (!ids.some((id) => String(id) === String(p.id))) onChange([...ids, p.id]) }
  const remove = (id: any) => onChange(ids.filter((x) => String(x) !== String(id)))
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= ids.length) return; const n = [...ids]; const t = n[i]; n[i] = n[j]; n[j] = t; onChange(n) }
  return (
    <div className="pe__rows">
      {selected.length > 0 && (
        <div className="pe__pubsel">
          {selected.map((p, i) => (
            <div className="pe__pubrow" key={String(p.id)}>
              <div className="pe__pubthumb">{p.posterUrl ? <img src={p.posterUrl} alt="" /> : <span>{(p.title || '?').slice(0, 1)}</span>}</div>
              <div className="pe__pubttl">{p.title}</div>
              <div className="pe__ctrls">
                <button type="button" style={rowBtn} onClick={() => move(i, -1)} title="Выше"><ChevronUp size={15} /></button>
                <button type="button" style={rowBtn} onClick={() => move(i, 1)} title="Ниже"><ChevronDown size={15} /></button>
                <button type="button" style={{ ...rowBtn, color: '#e5484d' }} onClick={() => remove(p.id)} title="Убрать"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <input className="studio-input" placeholder="Поиск публикации по названию…" value={q} onChange={(e) => setQ(e.target.value)} />
      {loading && <div className="pe__note">Поиск…</div>}
      {results.length > 0 && (
        <div className="pe__pubres">
          {results.map((p) => { const on = ids.some((id) => String(id) === String(p.id)); return (
            <button type="button" key={String(p.id)} className={'pe__pubopt' + (on ? ' on' : '')} onClick={() => add(p)} disabled={on}>
              <div className="pe__pubthumb">{p.posterUrl ? <img src={p.posterUrl} alt="" /> : <span>{(p.title || '?').slice(0, 1)}</span>}</div>
              <span className="pe__pubttl">{p.title}</span>{on && <Check size={14} />}
            </button>
          ) })}
        </div>
      )}
      <div className="pe__note">Прикреплённые публикации покажутся карточками на странице (в этом порядке).</div>
    </div>
  )
}

/** Загрузчик фото для блока «Шапка». Файл уходит в media, в блок кладём URL. */
function HeroImage({ url, onChange }: { url?: string; onChange: (u: string) => void }) {
  const ref = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const upload = async (f: File) => {
    setBusy(true); setErr(null)
    const ctrl = new AbortController()
    const to = setTimeout(() => ctrl.abort(), 30000)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch('/studio/api/upload-cover', { method: 'POST', body: fd, credentials: 'include', signal: ctrl.signal })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.url) onChange(j.url)
      else setErr(j.error || 'Не удалось загрузить фото')
    } catch (e) {
      setErr((e as { name?: string })?.name === 'AbortError' ? 'Хранилище временно недоступно, попробуйте позже.' : 'Ошибка загрузки')
    } finally {
      clearTimeout(to); setBusy(false)
      if (ref.current) ref.current.value = ''
    }
  }
  return (
    <div className="pe__heroimg">
      <div className="pe__heroimg-prev">{url ? <img src={url} alt="" /> : <span>Фото</span>}</div>
      <div className="pe__heroimg-ctrls">
        <button type="button" className="studio-btn studio-btn--ghost" onClick={() => ref.current?.click()} disabled={busy}>
          <ImageIcon size={15} /> {busy ? 'Загрузка…' : (url ? 'Заменить фото' : 'Загрузить фото')}
        </button>
        {url && <button type="button" className="studio-btn studio-btn--ghost" onClick={() => onChange('')}><Trash2 size={14} /> Убрать</button>}
      </div>
      {err && <div className="pe__note" style={{ color: '#e5484d' }}>{err}</div>}
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f) }} />
    </div>
  )
}

/**
 * Текстовое поле с лёгким markdown: мини-панель вставки и подсказка.
 * Хранение остаётся простым текстом; рендер понимает «## », **жирный**,
 * *курсив*, [текст](ссылка) и списки «- ». Панель просто вставляет разметку.
 */
/**
 * Вставка форматированного текста (Word, Google Docs, веб) → наш Markdown-набор:
 * **жирный**, *курсив*, [текст](ссылка), «## подзаголовок», списки «- ». Иначе при
 * вставке в обычную textarea оформление терялось. Разбираем HTML буфера через DOMParser
 * и обходим дерево; при отсутствии HTML — обычная вставка (native).
 */
function htmlToMd(html: string): string {
  let doc: Document
  try { doc = new DOMParser().parseFromString(html, 'text/html') } catch { return '' }
  const isBold = (el: HTMLElement): boolean => {
    const w = el.style.fontWeight
    if (w) return w === 'bold' || w === 'bolder' || (/^\d+$/.test(w) && Number(w) >= 600)
    return el.tagName === 'STRONG' || el.tagName === 'B'
  }
  const isItalic = (el: HTMLElement): boolean => {
    const st = el.style.fontStyle
    if (st) return st === 'italic'
    return el.tagName === 'EM' || el.tagName === 'I'
  }
  const kids = (node: Node): string => {
    let out = ''
    node.childNodes.forEach((c) => { out += ser(c) })
    return out
  }
  const ser = (node: Node): string => {
    if (node.nodeType === 3) return (node.textContent || '').replace(/\s+/g, ' ')
    if (node.nodeType !== 1) return ''
    const el = node as HTMLElement
    const tag = el.tagName
    if (tag === 'BR') return '\n'
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'HEAD') return ''
    const inner = kids(el)
    if (tag === 'A') { const href = el.getAttribute('href') || ''; const t = inner.trim(); return href && t ? `[${t}](${href})` : inner }
    if (/^H[1-6]$/.test(tag)) return '\n\n## ' + inner.trim() + '\n\n'
    if (tag === 'LI') return '- ' + inner.trim() + '\n'
    if (tag === 'UL' || tag === 'OL') return '\n' + inner + '\n'
    if (tag === 'P' || tag === 'DIV' || tag === 'BLOCKQUOTE' || tag === 'TR') return '\n\n' + inner + '\n\n'
    if (!inner.trim()) return inner
    if (isBold(el) && !inner.includes('*')) return '**' + inner.trim() + '**'
    if (isItalic(el) && !inner.includes('*')) return '*' + inner.trim() + '*'
    return inner
  }
  let md = kids(doc.body)
  md = md.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim()
  return md
}

function MdArea({ value, onChange, rows = 5, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const ref = React.useRef<HTMLTextAreaElement>(null)
  const [sel, setSel] = React.useState<[number, number] | null>(null)
  React.useEffect(() => {
    if (sel && ref.current) { ref.current.focus(); ref.current.setSelectionRange(sel[0], sel[1]); setSel(null) }
  }, [sel])
  const apply = (kind: 'h' | 'b' | 'i' | 'li' | 'link') => {
    const ta = ref.current
    const v = value ?? ''
    const start = ta ? (ta.selectionStart ?? v.length) : v.length
    const end = ta ? (ta.selectionEnd ?? v.length) : v.length
    const before = v.slice(0, start), selected = v.slice(start, end), after = v.slice(end)
    let nv = v, ns = start, ne = end
    const wrap = (mark: string, ph: string) => {
      const inner = selected || ph
      nv = before + mark + inner + mark + after
      ns = before.length + mark.length; ne = ns + inner.length
    }
    const linePrefix = (pfx: string) => {
      const ls = before.lastIndexOf('\n') + 1
      nv = v.slice(0, ls) + pfx + v.slice(ls)
      ns = ne = end + pfx.length
    }
    if (kind === 'h') linePrefix('## ')
    else if (kind === 'li') linePrefix('- ')
    else if (kind === 'b') wrap('**', 'жирный')
    else if (kind === 'i') wrap('*', 'курсив')
    else if (kind === 'link') {
      const label = selected || 'текст'
      nv = before + '[' + label + '](https://)' + after
      ns = before.length + label.length + 3; ne = ns + 'https://'.length
    }
    onChange(nv)
    setSel([ns, ne])
  }
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData('text/html')
    if (!html || !/<(strong|b|em|i|a|h[1-6]|li|ul|ol)\b/i.test(html)) return // обычный текст — нативная вставка
    const md = htmlToMd(html)
    if (!md) return
    e.preventDefault()
    const ta = e.currentTarget
    const v = value ?? ''
    const start = ta.selectionStart ?? v.length
    const end = ta.selectionEnd ?? v.length
    const nv = v.slice(0, start) + md + v.slice(end)
    onChange(nv)
    const caret = start + md.length
    setSel([caret, caret])
  }
  return (
    <div className="pe__md">
      <div className="pe__mdbar">
        <button type="button" onClick={() => apply('h')} title="Подзаголовок"><Heading size={14} /></button>
        <button type="button" onClick={() => apply('b')} title="Жирный"><Bold size={14} /></button>
        <button type="button" onClick={() => apply('i')} title="Курсив"><Italic size={14} /></button>
        <button type="button" onClick={() => apply('li')} title="Список"><List size={14} /></button>
        <button type="button" onClick={() => apply('link')} title="Ссылка"><Link2 size={14} /></button>
      </div>
      <textarea ref={ref} className="studio-input pe__ta" rows={rows} placeholder={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value)} onPaste={onPaste} />
    </div>
  )
}

function BlockBody({ block, patch, cats, media }: { block: PBlock; patch: (p: Partial<PBlock>) => void; cats?: { id: number | string; title: string }[]; media?: PEMedia }) {
  switch (block.type) {
    case 'text':
      return (
        <MdArea rows={5} placeholder="Текст раздела. Абзацы разделяйте пустой строкой." value={block.body ?? ''} onChange={(v) => patch({ body: v } as Partial<PBlock>)} />
      )
    case 'hero':
      return (
        <div className="pe__rows">
          <HeroImage url={block.imageUrl} onChange={(u) => patch({ imageUrl: u } as Partial<PBlock>)} />
          <input className="studio-input" placeholder="Надзаголовок — напр. ВОКАЛИСТ · БАРИТОН" value={block.eyebrow ?? ''} onChange={(e) => patch({ eyebrow: e.target.value } as Partial<PBlock>)} />
          <input className="studio-input" placeholder="Подзаголовок — напр. настоящее имя" value={block.subtitle ?? ''} onChange={(e) => patch({ subtitle: e.target.value } as Partial<PBlock>)} />
          <MdArea rows={3} placeholder="Лид — короткое вступление под заголовком" value={block.lead ?? ''} onChange={(val) => patch({ lead: val } as Partial<PBlock>)} />
          <div className="pe__note">Крупный заголовок берётся из названия публикации (поле «Заголовок» вверху). Фото шапки не связано с обложкой для карточек.</div>
        </div>
      )
    case 'facts':
      return <ArrayEditor items={block.items} cols={[{ key: 'label', label: 'Метка', w: 1 }, { key: 'value', label: 'Значение', w: 2 }]} blank={() => ({ label: '', value: '' })} onChange={(n) => patch({ items: n } as Partial<PBlock>)} />
    case 'timeline':
      return <ArrayEditor items={block.items} cols={[{ key: 'year', label: 'Год', w: 1 }, { key: 'title', label: 'Заголовок', w: 2 }, { key: 'text', label: 'Описание', textarea: true }]} blank={() => ({ year: '', title: '', text: '' })} onChange={(n) => patch({ items: n } as Partial<PBlock>)} />
    case 'relations':
      return <ArrayEditor items={block.items} cols={[{ key: 'name', label: 'Имя' }, { key: 'text', label: 'Описание', textarea: true }]} blank={() => ({ name: '', text: '' })} onChange={(n) => patch({ items: n } as Partial<PBlock>)} />
    case 'releases':
      return <ArrayEditor items={block.items} cols={[{ key: 'title', label: 'Название', w: 2 }, { key: 'meta', label: 'Тип/подпись', w: 1 }, { key: 'year', label: 'Год', w: 1 }]} blank={() => ({ title: '', meta: '', year: '' })} onChange={(n) => patch({ items: n } as Partial<PBlock>)} />
    case 'films':
      return <ArrayEditor items={block.items} cols={[{ key: 'title', label: 'Название', w: 2 }, { key: 'meta', label: 'Тип', w: 1 }, { key: 'year', label: 'Год', w: 1 }]} blank={() => ({ title: '', meta: '', year: '' })} onChange={(n) => patch({ items: n } as Partial<PBlock>)} />
    case 'awards':
      return <AwardsEditor items={block.items} onChange={(n) => patch({ items: n } as Partial<PBlock>)} />
    case 'factsList':
      return <FactsEditor items={block.items} onChange={(n) => patch({ items: n } as Partial<PBlock>)} />
    case 'gallery':
      return media ? (
        <div className="pe__rows">
          <GalleryComposer value={block.images ?? []} onChange={(v) => patch({ images: v } as Partial<PBlock>)} folders={media.galleryFolders} publicationId={media.publicationId} />
          <div className="pe__note">Своя галерея этого блока (у каждого блока — свой набор). На сайте показывается сеткой, по клику фото открывается на весь экран.</div>
        </div>
      ) : <div className="pe__note">Загрузка фото доступна в редакторе публикации.</div>
    case 'videos':
      return media ? (
        <div className="pe__rows">
          <VideoAttachPicker videos={media.videoCandidates} value={media.videoIds} onChange={media.setVideoIds} categoryTree={media.videoModalCats} searchPlaceholder="Поиск видео по названию…" emptyLabel="Нет загруженных видео" icon={Video} leadingButton={media.canCreateMedia ? <button type="button" className="gcomp__add" onClick={media.openVideoModal}><Plus size={16} /> Добавить видео</button> : undefined} />
          <div className="pe__note">Ролики появятся на странице в этом месте, в указанном порядке.</div>
        </div>
      ) : <div className="pe__note">Добавление видео доступно в редакторе публикации.</div>
    case 'columns': {
      const cols = block.cols ?? []
      const setCols = (n: any[]) => patch({ cols: n } as Partial<PBlock>)
      return (
        <div className="pe__rows">
          <div className="pe__colsgrid">
            {cols.map((c, i) => (
              <div className="pe__coled" key={i}>
                <input className="studio-input" placeholder={`Заголовок колонки ${i + 1} (необяз.)`} value={c.title ?? ''} onChange={(e) => setCols(cols.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                <MdArea rows={4} placeholder="Текст колонки" value={c.body ?? ''} onChange={(v) => setCols(cols.map((x, j) => j === i ? { ...x, body: v } : x))} />
                <button type="button" className="studio-btn studio-btn--ghost" onClick={() => setCols(cols.filter((_, j) => j !== i))} disabled={cols.length <= 1}><Trash2 size={14} /> Убрать колонку</button>
              </div>
            ))}
          </div>
          {cols.length < 3 && <button type="button" className="studio-btn studio-btn--ghost pe__add" onClick={() => setCols([...cols, { body: '' }])}><Plus size={15} /> Добавить колонку</button>}
        </div>
      )
    }
    case 'callout':
      return (
        <div className="pe__rows">
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={'studio-btn ' + (block.variant !== 'note' ? 'studio-btn--primary' : 'studio-btn--ghost')} onClick={() => patch({ variant: 'quote' } as Partial<PBlock>)}>Цитата</button>
            <button type="button" className={'studio-btn ' + (block.variant === 'note' ? 'studio-btn--primary' : 'studio-btn--ghost')} onClick={() => patch({ variant: 'note' } as Partial<PBlock>)}>Заметка</button>
          </div>
          <MdArea rows={3} placeholder="Текст выноски" value={block.text ?? ''} onChange={(v) => patch({ text: v } as Partial<PBlock>)} />
          <input className="studio-input" placeholder="Автор / подпись (необяз.)" value={block.author ?? ''} onChange={(e) => patch({ author: e.target.value } as Partial<PBlock>)} />
        </div>
      )
    case 'categoryRow':
      return <CategoryRowEditor categoryId={block.categoryId} cats={cats} patch={patch} />
    case 'button':
      return (
        <div className="pe__rows">
          <input className="studio-input" placeholder="Текст кнопки" value={block.label ?? ''} onChange={(e) => patch({ label: e.target.value } as Partial<PBlock>)} />
          <input className="studio-input" placeholder="Ссылка (URL или /путь)" value={block.href ?? ''} onChange={(e) => patch({ href: e.target.value } as Partial<PBlock>)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={'studio-btn ' + (block.variant !== 'ghost' ? 'studio-btn--primary' : 'studio-btn--ghost')} onClick={() => patch({ variant: 'primary' } as Partial<PBlock>)}>Заливка</button>
            <button type="button" className={'studio-btn ' + (block.variant === 'ghost' ? 'studio-btn--primary' : 'studio-btn--ghost')} onClick={() => patch({ variant: 'ghost' } as Partial<PBlock>)}>Контур</button>
          </div>
        </div>
      )
    case 'publications':
      return <PublicationsPicker ids={block.ids ?? []} onChange={(v) => patch({ ids: v } as Partial<PBlock>)} />
    case 'divider':
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          {(['line', 'dots', 'space'] as const).map((v) => (
            <button type="button" key={v} className={'studio-btn ' + (((block.variant || 'line') === v) ? 'studio-btn--primary' : 'studio-btn--ghost')} onClick={() => patch({ variant: v } as Partial<PBlock>)}>{v === 'line' ? 'Линия' : v === 'dots' ? 'Точки' : 'Отступ'}</button>
          ))}
        </div>
      )
    default:
      return null
  }
}

/** Короткое превью содержимого блока для свёрнутого вида. */
function previewOf(b: PBlock): string {
  const cut = (t: string) => { const x = (t || '').replace(/\s+/g, ' ').trim(); return x.length > 90 ? x.slice(0, 90) + '…' : x }
  switch (b.type) {
    case 'hero': return cut([b.eyebrow, b.subtitle, b.lead].filter(Boolean).join(' · ')) || 'Шапка страницы'
    case 'text': return cut(b.body) || 'Пустой текст'
    case 'callout': return cut(b.text) || 'Выноска'
    case 'columns': return `${b.cols?.length || 0} колонки`
    case 'facts': return `${b.items?.length || 0} фактов`
    case 'factsList': return `${b.items?.length || 0} плиток`
    case 'timeline': return `${b.items?.length || 0} пунктов`
    case 'relations': return `${b.items?.length || 0} пунктов`
    case 'releases': return `${b.items?.length || 0} карточек`
    case 'films': return `${b.items?.length || 0} карточек`
    case 'awards': return `${b.items?.length || 0} плашек`
    case 'gallery': return `${b.images?.length || 0} фото`
    case 'videos': return 'Видео'
    case 'publications': return `${b.ids?.length || 0} публикаций`
    case 'categoryRow': return 'Ряд-постеры категории'
    case 'button': return cut(b.label) || 'Кнопка'
    case 'divider': return 'Разделитель'
    default: return ''
  }
}

function BlockCard({ block, index, total, patch, move, remove, cats, media, collapsed, onToggleCollapse }: {
  block: PBlock
  index: number
  total: number
  patch: (p: Partial<PBlock>) => void
  move: (d: number) => void
  remove: () => void
  cats?: { id: number | string; title: string }[]
  media?: PEMedia
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const full = (block as { full?: boolean }).full
  const enabled = (block as { enabled?: boolean }).enabled !== false
  return (
    <div className={'pe__card' + (enabled ? '' : ' pe__card--off') + (collapsed ? ' pe__card--collapsed' : '')}>
      <div className="pe__card-head">
        <button type="button" className="pe__collapse" onClick={onToggleCollapse} title={collapsed ? 'Развернуть' : 'Свернуть'} aria-label={collapsed ? 'Развернуть' : 'Свернуть'}>{collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}</button>
        <span className="pe__ico"><BlockIcon type={block.type} /></span>
        <span className="pe__card-kind">{BLOCK_LABEL[block.type]}</span>
        {block.type === 'hero' ? <div style={{ flex: 1 }} /> : <input className="studio-input pe__title" placeholder={BLOCK_LABEL[block.type]} value={block.title ?? ''} onChange={(e) => patch({ title: e.target.value } as Partial<PBlock>)} />}
        <div className="pe__ctrls">
          <label className="homebld__toggle pe__toggle" title={enabled ? 'Блок показывается — нажмите, чтобы скрыть' : 'Блок скрыт — нажмите, чтобы показать'}>
            <input type="checkbox" checked={enabled} onChange={() => patch({ enabled: !enabled } as Partial<PBlock>)} />
            <span className="homebld__toggle-track" aria-hidden="true"><span className="homebld__toggle-thumb" /></span>
          </label>
          {block.type !== 'hero' && <>
            <button type="button" style={{ ...rowBtn, width: 'auto', padding: '0 9px', fontSize: 11, fontWeight: 600, color: full ? '#2f6bed' : 'var(--st-text-muted)', borderColor: full ? '#2f6bed' : 'var(--st-border)' }} onClick={() => patch({ full: !full } as Partial<PBlock>)} title="Ширина секции">{full ? 'Во всю ширину' : 'Обычная'}</button>
            <button type="button" style={rowBtn} onClick={() => move(-1)} disabled={index === 0} title="Выше"><ChevronUp size={15} /></button>
            <button type="button" style={rowBtn} onClick={() => move(1)} disabled={index === total - 1} title="Ниже"><ChevronDown size={15} /></button>
            <button type="button" style={{ ...rowBtn, color: '#e5484d' }} onClick={remove} title="Удалить блок"><Trash2 size={15} /></button>
          </>}
        </div>
      </div>
      {collapsed
        ? <div className="pe__card-prev" onClick={onToggleCollapse}>{previewOf(block)}</div>
        : <div className="pe__card-body"><BlockBody block={block} patch={patch} cats={cats} media={media} /></div>}
    </div>
  )
}

export function ProfileEditor({ value, onChange, cats, media, onApplySuggest }: { value: ProfileData | null; onChange: (v: ProfileData) => void; cats?: { id: number | string; title: string }[]; media?: PEMedia; onApplySuggest?: (s: { title?: string; tags?: string[] }) => void }) {
  const v: ProfileData = value || {}

  // Блоки: берём v.blocks, иначе мигрируем из legacy-полей.
  const blocks: PBlock[] = React.useMemo(() => toBlocks(v), [v])

  // При записи блоков очищаем legacy-поля, чтобы не было двойного рендера.
  const writeBlocks = (next: PBlock[]) => onChange({
    ...v, blocks: next,
    sections: undefined, timeline: undefined, relations: undefined,
    releases: undefined, films: undefined, awards: undefined, facts: undefined,
    eyebrow: undefined, subtitle: undefined, lead: undefined, quickFacts: undefined,
  })
  const addBlock = (type: PBlockType) => writeBlocks([...blocks, blankBlock(type, newId())])
  const patchBlock = (i: number, p: Partial<PBlock>) => writeBlocks(blocks.map((b, j) => j === i ? ({ ...b, ...p } as PBlock) : b))
  const moveBlock = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= blocks.length) return; const n = [...blocks]; const t = n[i]; n[i] = n[j]; n[j] = t; writeBlocks(n) }
  const removeBlock = (i: number) => writeBlocks(blocks.filter((_, j) => j !== i))

  const [menuOpen, setMenuOpen] = React.useState<null | 'top' | 'bottom'>(null)
  const [aiOpen, setAiOpen] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set())
  const toggleCollapse = (id: string) => setCollapsed((s2) => { const n = new Set(s2); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allCollapsed = blocks.length > 0 && blocks.every((b) => collapsed.has(b.id))
  const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(blocks.map((b) => b.id)))

  const addMenuEl = (cls: string) => (
    <div className={`pe__menu ${cls}`.trim()}>
      {ADD_MENU.map((m) => (
        <button type="button" key={m.type} className="pe__menu-item" onClick={() => { addBlock(m.type); setMenuOpen(null) }}>
          <span className="pe__ico"><BlockIcon type={m.type} /></span>
          <span className="pe__menu-txt"><b>{BLOCK_LABEL[m.type]}</b><span>{m.hint}</span></span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="pe">
      <style dangerouslySetInnerHTML={{ __html: PE_CSS }} />
      <div className="studio-notice"><Info size={18} /><span>Шаблон «Страница»: вся страница собирается из блоков — добавляйте, удаляйте и двигайте их в нужном порядке.</span></div>

      <div className="pe__blocks-title">Блоки страницы <em>{blocks.length}</em>
        <div className="pe__bt-actions">
          <div className="pe__addtop">
            <button type="button" className="pe__toolbtn" onClick={() => setMenuOpen((o) => o === 'top' ? null : 'top')}>{menuOpen === 'top' ? <><X size={14} /> Закрыть окно</> : <><Plus size={14} /> Добавить блок</>}</button>
            {menuOpen === 'top' && addMenuEl('pe__menu--top')}
          </div>
          <button type="button" className="pe__toolbtn pe__ai" onClick={() => setAiOpen(true)}><Sparkles size={14} /> Заполнить с помощью AI</button>
          {blocks.length > 1 && <button type="button" className="pe__collapse-all" onClick={toggleAll}>{allCollapsed ? 'Развернуть все' : 'Свернуть все'}</button>}
        </div>
      </div>
      {blocks.length === 0 && <div className="pe__empty">Пока нет ни одного блока. Добавьте первый ниже.</div>}
      {blocks.map((b, i) => (
        <BlockCard key={b.id} block={b} index={i} total={blocks.length} patch={(p) => patchBlock(i, p)} move={(d) => moveBlock(i, d)} remove={() => removeBlock(i)} cats={cats} media={media} collapsed={collapsed.has(b.id)} onToggleCollapse={() => toggleCollapse(b.id)} />
      ))}

      <div className="pe__addwrap">
        <button type="button" className="studio-btn studio-btn--primary pe__addblock" onClick={() => setMenuOpen((o) => o === 'bottom' ? null : 'bottom')}>{menuOpen === 'bottom' ? <><X size={16} /> Закрыть окно</> : <><Plus size={16} /> Добавить блок</>}</button>
        {menuOpen === 'bottom' && addMenuEl('')}
      </div>

      <AiComposeModal open={aiOpen} onClose={() => setAiOpen(false)} existingBlocks={blocks} onApplySuggest={onApplySuggest} onInsert={(ai, mode) => writeBlocks(mode === 'replace' ? ai : [...blocks, ...ai])} />
    </div>
  )
}

const PE_CSS = `
.pe{margin:6px 0 4px}
.pe__hint{font-size:12.5px;color:var(--st-text-muted);background:color-mix(in srgb,var(--st-accent) 9%,transparent);border:1px solid color-mix(in srgb,var(--st-accent) 22%,transparent);border-radius:12px;padding:10px 14px;margin-bottom:14px;line-height:1.4}
.pe .pe__ta{resize:vertical;min-height:70px;font-family:inherit}
.pe__hero{display:flex;flex-direction:column;gap:12px;padding:14px;border:1px solid var(--st-border);border-radius:12px;background:var(--st-surface);margin-bottom:18px}
.pe__ai{color:#2f6bed;border-color:color-mix(in srgb,#2f6bed 30%,transparent)}
.pe__blocks-title{font-weight:700;font-size:14px;color:var(--st-text);display:flex;align-items:center;gap:8px;margin:4px 2px 10px}
.pe__blocks-title em{font-style:normal;font-size:12px;color:var(--st-text-muted);background:color-mix(in srgb,var(--st-text) 8%,transparent);border-radius:999px;padding:2px 9px;font-weight:700}
.pe__empty{font-size:13px;color:var(--st-text-muted);padding:14px;border:1px dashed var(--st-border);border-radius:12px;text-align:center;margin-bottom:12px}
.pe__card{border:1px solid var(--st-border);border-radius:12px;margin-bottom:10px;background:var(--st-surface);overflow:hidden}
.pe__card-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--st-border);background:color-mix(in srgb,var(--st-text) 3%,transparent)}
.pe__grip{color:var(--st-text-muted);flex:none}
.pe__ico{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:color-mix(in srgb,#2f6bed 12%,transparent);color:#2f6bed;flex:none}
.pe__card-kind{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--st-text-muted);background:color-mix(in srgb,var(--st-text) 8%,transparent);border-radius:999px;padding:3px 10px;flex:none}
.pe__title{flex:1;min-width:100px;height:32px}
.pe__card-body{padding:12px 14px}
.pe__note{font-size:12.5px;color:var(--st-text-muted);line-height:1.45}
.pe__rows{display:flex;flex-direction:column;gap:10px}
.pe__row{display:flex;gap:8px;align-items:flex-start}
.pe__fields{flex:1;display:flex;gap:8px;flex-wrap:wrap}
.pe__ctrls{display:flex;gap:4px;flex:none}
.pe__add{align-self:flex-start;margin-top:2px}
.pe__addwrap{position:relative;margin-top:6px}
.pe__addblock{width:100%;justify-content:center}
.pe__menu{position:absolute;left:0;right:0;bottom:calc(100% + 6px);z-index:20;background:var(--st-surface);border:1px solid var(--st-border);border-radius:12px;box-shadow:0 12px 34px rgba(0,0,0,.18);padding:6px;display:grid;grid-template-columns:1fr 1fr;gap:4px}
.pe__menu-item{display:flex;flex-direction:row;gap:10px;align-items:center;text-align:left;border:1px solid transparent;background:transparent;border-radius:9px;padding:8px 11px;cursor:pointer;color:var(--st-text)}
.pe__menu-txt{display:flex;flex-direction:column;gap:2px;min-width:0}
.pe__menu-item:hover{background:color-mix(in srgb,var(--st-accent) 12%,transparent);border-color:color-mix(in srgb,var(--st-accent) 26%,transparent)}
.pe__menu-item b{font-size:13px;font-weight:600}
.pe__menu-item span{font-size:11.5px;color:var(--st-text-muted)}
.pe__colsgrid{display:grid;grid-template-columns:1fr;gap:12px}
.pe__coled{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--st-border);border-radius:10px;background:color-mix(in srgb,var(--st-text) 2%,transparent)}
.pe__iconbtn{width:38px;height:38px;flex:none;border:1px solid var(--st-border);border-radius:8px;background:var(--st-surface);color:var(--st-text);display:grid;place-items:center;cursor:pointer;font-size:16px}
.pe__iconbtn:hover{border-color:#2f6bed;color:#2f6bed}
.pe__iconov{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.4)}
.pe__iconpanel{position:fixed;left:0;top:0;bottom:0;width:340px;max-width:90vw;background:var(--st-surface);border-right:1px solid var(--st-border);box-shadow:12px 0 40px rgba(0,0,0,.25);display:flex;flex-direction:column;padding:14px}
.pe__iconhead{display:flex;gap:8px;margin-bottom:12px;flex:none}
.pe__iconclose{flex:none;width:36px;border:1px solid var(--st-border);border-radius:8px;background:var(--st-surface);color:var(--st-text-muted);cursor:pointer;display:grid;place-items:center}
.pe__icongrid{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:8px;overflow-y:auto;align-content:start}
.pe__iconcell{aspect-ratio:1;border:1px solid var(--st-border);border-radius:10px;background:var(--st-surface);color:var(--st-text);display:grid;place-items:center;cursor:pointer;transition:border-color .12s,color .12s,background .12s}
.pe__iconcell:hover{border-color:#2f6bed;color:#2f6bed;background:color-mix(in srgb,#2f6bed 8%,transparent)}
.pe__iconcell.on{border-color:#2f6bed;color:#fff;background:#2f6bed}
.pe__pubsel{display:flex;flex-direction:column;gap:6px}
.pe__pubrow{display:flex;align-items:center;gap:10px;padding:6px;border:1px solid var(--st-border);border-radius:10px;background:var(--st-surface)}
.pe__pubthumb{width:34px;height:46px;flex:none;border-radius:6px;overflow:hidden;position:relative;background:linear-gradient(135deg,var(--st-accent,#8b5cf6),color-mix(in srgb,var(--st-accent,#8b5cf6) 45%,#000));display:grid;place-items:center;color:#fff;font-weight:700;font-size:13px}
.pe__pubthumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.pe__pubttl{flex:1;min-width:0;font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pe__pubres{display:flex;flex-direction:column;gap:4px;max-height:260px;overflow-y:auto;border:1px solid var(--st-border);border-radius:10px;padding:6px}
.pe__pubopt{display:flex;align-items:center;gap:10px;padding:6px;border:1px solid transparent;border-radius:8px;background:transparent;cursor:pointer;color:var(--st-text);text-align:left}
.pe__pubopt:hover:not(:disabled){background:color-mix(in srgb,#2f6bed 8%,transparent);border-color:color-mix(in srgb,#2f6bed 26%,transparent)}
.pe__pubopt:disabled{opacity:.55;cursor:default}
.pe__pubopt .pe__pubttl{font-weight:500}
.pe__crowprev{display:flex;gap:8px;overflow-x:auto;padding:4px 0 8px}
.pe__pcardprev{flex:0 0 auto;width:72px}
.pe__pframe{position:relative;width:72px;aspect-ratio:2/3;border-radius:8px;overflow:hidden;background:linear-gradient(135deg,var(--st-accent,#8b5cf6),color-mix(in srgb,var(--st-accent,#8b5cf6) 45%,#000));display:grid;place-items:center;color:#fff;font-weight:700}
.pe__pframe img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.pe__pttl{font-size:10.5px;color:var(--st-text-muted);margin-top:4px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pe__md{display:flex;flex-direction:column;gap:6px}
.pe__mdbar{display:flex;gap:4px;flex-wrap:wrap}
.pe__mdbar button{width:30px;height:28px;display:grid;place-items:center;border:1px solid var(--st-border);border-radius:7px;background:var(--st-surface);color:var(--st-text-muted);cursor:pointer;transition:border-color .12s,color .12s,background .12s}
.pe__mdbar button:hover{border-color:#2f6bed;color:#2f6bed;background:color-mix(in srgb,#2f6bed 8%,transparent)}
.pe__md .pe__note b{color:var(--st-text);font-weight:600}
.pe__heroimg{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.pe__heroimg-prev{width:64px;height:86px;flex:none;border-radius:10px;overflow:hidden;border:1px solid var(--st-border);background:var(--st-surface-2);display:grid;place-items:center;position:relative}
.pe__heroimg-prev img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.pe__heroimg-prev span{font-size:10.5px;color:var(--st-text-muted)}
.pe__heroimg-ctrls{display:flex;gap:6px;flex-wrap:wrap}
.pe__toggle{margin-right:2px}
.pe__fact{resize:none;overflow:hidden;min-height:46px;line-height:1.45;font-family:inherit}
.pe__collapse{flex:none;width:26px;height:26px;display:grid;place-items:center;border:none;background:transparent;color:var(--st-text-muted);cursor:pointer;border-radius:6px}
.pe__collapse:hover{background:color-mix(in srgb,var(--st-text) 8%,transparent);color:var(--st-text)}
.pe__card--collapsed .pe__card-head{border-bottom:none}
.pe__card-prev{padding:8px 14px 10px 46px;font-size:12.5px;color:var(--st-text-muted);cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pe__collapse-all{font-size:12px;font-weight:600;color:var(--st-text-muted);background:transparent;border:1px solid var(--st-border);border-radius:8px;padding:3px 10px;cursor:pointer}
.pe__collapse-all:hover{border-color:#2f6bed;color:#2f6bed}
.pe__bt-actions{margin-left:auto;display:flex;align-items:center;gap:8px}
.pe__addtop{position:relative;display:inline-flex}
.pe__toolbtn{font-size:12px;font-weight:600;color:var(--st-text-muted);background:transparent;border:1px solid var(--st-border);border-radius:8px;padding:3px 10px;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.pe__toolbtn:hover{border-color:#2f6bed;color:#2f6bed}
.pe__menu--top{top:calc(100% + 6px);bottom:auto;left:auto;right:0;min-width:360px}
.pe__card--off{border-style:dashed}
.pe__card--off .pe__card-body{opacity:.4}
.pe__card--off .pe__card-kind::after{content:' · скрыт';color:var(--st-text-muted);font-weight:600}
`
