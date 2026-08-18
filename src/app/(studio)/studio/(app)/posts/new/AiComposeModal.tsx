'use client'
import React from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X, Send, Loader2, ArrowLeft, Check, Eye, Trash2, Pencil, ArrowUp, ArrowDown } from 'lucide-react'
import { BLOCK_LABEL, type PBlock } from '@/lib/profileBlocks'
import { RATE_IN_RUB_PER_M, RATE_OUT_RUB_PER_M } from '@/lib/aiPricing'

/**
 * Модалка «Заполнить с помощью AI»: автор вставляет сплошной текст, Ася
 * (capability compose) предлагает разбивку на блоки, автор правит её в диалоге,
 * видит читаемое превью, управляет составом (вкл/выкл, порядок, правка, удаление)
 * и вставляет в конструктор (добавить/заменить). Стоимость токенов — оценочная.
 */
type Msg = { role: 'assistant' | 'user'; content: string }
type InsertMode = 'append' | 'replace'

const RUB = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 })
const rubFmt = (n: number) => RUB.format(n || 0)
/** Грубая оценка стоимости разбора до запуска: вход ≈ символы/3, выход ≈ 40% входа. */
function estCostRub(chars: number): number {
  const tin = Math.max(0, chars / 3)
  const tout = tin * 0.4
  return (tin / 1e6) * RATE_IN_RUB_PER_M + (tout / 1e6) * RATE_OUT_RUB_PER_M
}

/* ── Мини-Markdown → HTML (жирный/курсив/подзаголовок/списки/абзацы) ── */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function inlineMd(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}
function mdToHtml(body: string): string {
  const blocks = String(body || '').split(/\n{2,}/)
  const out: string[] = []
  for (const b of blocks) {
    const lines = b.split('\n')
    if (lines.every((l) => /^\s*-\s+/.test(l))) {
      out.push('<ul>' + lines.map((l) => `<li>${inlineMd(l.replace(/^\s*-\s+/, ''))}</li>`).join('') + '</ul>')
    } else if (/^\s*##\s+/.test(b)) {
      out.push(`<h4>${inlineMd(b.replace(/^\s*##\s+/, ''))}</h4>`)
    } else {
      out.push(`<p>${inlineMd(b).replace(/\n/g, '<br/>')}</p>`)
    }
  }
  return out.join('')
}

const PLACEHOLDER_NOTE: Record<string, string> = {
  gallery: '🖼 Галерея — добавьте фото в конструкторе',
  videos: '🎬 Видео — выберите ролики в конструкторе',
  categoryRow: '🎞 Ряд постеров — выберите категорию',
  publications: '📄 Публикации — прикрепите материалы',
  button: '🔗 Кнопка — задайте ссылку',
}

/** Читаемое превью одного блока — как он примерно будет выглядеть на странице. */
function BlockPreview({ b }: { b: PBlock }) {
  const anyB = b as any
  const title = anyB.title as string | undefined
  const head = title ? <div className="aic__pv-title">{title}</div> : null
  switch (b.type) {
    case 'hero':
      return (
        <div className="aic__pv-hero">
          {anyB.eyebrow && <div className="aic__pv-eyebrow">{anyB.eyebrow}</div>}
          {anyB.subtitle && <div className="aic__pv-sub">{anyB.subtitle}</div>}
          {anyB.lead && <div className="aic__pv-body" dangerouslySetInnerHTML={{ __html: mdToHtml(anyB.lead) }} />}
        </div>
      )
    case 'facts':
      return (
        <div>{head}<div className="aic__pv-facts">{(anyB.items || []).map((f: any, i: number) => (
          <div key={i} className="aic__pv-fact"><span>{f.label}</span><b>{f.value}</b></div>
        ))}</div></div>
      )
    case 'text':
      return <div>{head}<div className="aic__pv-body" dangerouslySetInnerHTML={{ __html: mdToHtml(anyB.body) }} /></div>
    case 'timeline':
      return <div>{head}<div className="aic__pv-tl">{(anyB.items || []).map((t: any, i: number) => (
        <div key={i} className="aic__pv-tlrow"><b>{t.year}</b> — {t.title}{t.text ? <div className="aic__pv-muted">{t.text}</div> : null}</div>
      ))}</div></div>
    case 'relations':
      return <div>{head}{(anyB.items || []).map((r: any, i: number) => (
        <div key={i} className="aic__pv-acc"><b>{r.name}</b><div className="aic__pv-body" dangerouslySetInnerHTML={{ __html: mdToHtml(r.text) }} /></div>
      ))}</div>
    case 'awards':
      return <div>{head}<div className="aic__pv-awards">{(anyB.items || []).map((a: any, i: number) => (
        <div key={i} className="aic__pv-award"><b>{a.title}</b>{a.subtitle ? <span> — {a.subtitle}</span> : null}</div>
      ))}</div></div>
    case 'factsList':
      return <div>{head}<ol className="aic__pv-ol">{(anyB.items || []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ol></div>
    case 'columns':
      return <div>{head}<div className="aic__pv-cols">{(anyB.cols || []).map((c: any, i: number) => (
        <div key={i} className="aic__pv-col">{c.title && <div className="aic__pv-title">{c.title}</div>}<div className="aic__pv-body" dangerouslySetInnerHTML={{ __html: mdToHtml(c.body) }} /></div>
      ))}</div></div>
    case 'callout':
      return <blockquote className="aic__pv-quote"><div dangerouslySetInnerHTML={{ __html: mdToHtml(anyB.text) }} />{anyB.author ? <cite>— {anyB.author}</cite> : null}</blockquote>
    case 'divider':
      return <hr className="aic__pv-hr" />
    default:
      return <div className="aic__pv-ph">{anyB._hint || PLACEHOLDER_NOTE[b.type] || BLOCK_LABEL[b.type]}</div>
  }
}

/** Быстрая правка текста блока перед вставкой (детали — в конструкторе после). */
function BlockEditor({ b, patch }: { b: PBlock; patch: (p: Partial<PBlock>) => void }) {
  const anyB = b as any
  const textField = b.type === 'text' ? 'body' : b.type === 'callout' ? 'text' : b.type === 'hero' ? 'lead' : null
  const hasTitle = b.type !== 'divider' && b.type !== 'hero'
  return (
    <div className="aic__edit">
      {hasTitle && (
        <input className="studio-input" placeholder="Заголовок блока" value={anyB.title ?? ''} onChange={(e) => patch({ title: e.target.value } as Partial<PBlock>)} />
      )}
      {b.type === 'hero' && (
        <>
          <input className="studio-input" placeholder="Надзаголовок" value={anyB.eyebrow ?? ''} onChange={(e) => patch({ eyebrow: e.target.value } as Partial<PBlock>)} />
          <input className="studio-input" placeholder="Подзаголовок" value={anyB.subtitle ?? ''} onChange={(e) => patch({ subtitle: e.target.value } as Partial<PBlock>)} />
        </>
      )}
      {textField && (
        <textarea className="studio-input aic__edit-ta" rows={4} placeholder="Текст (Markdown: **жирный**, *курсив*)" value={anyB[textField] ?? ''} onChange={(e) => patch({ [textField]: e.target.value } as Partial<PBlock>)} />
      )}
      <div className="aic__editnote">{textField ? 'Списки и детали удобнее доредактировать в конструкторе после вставки.' : 'Детали этого блока редактируются в конструкторе после вставки.'}</div>
    </div>
  )
}

const LOADER_STEPS = ['Читаю текст…', 'Определяю структуру…', 'Собираю блоки…', 'Проверяю разметку…', 'Почти готово…']

export function AiComposeModal({ open, onClose, onInsert, onApplySuggest, existingBlocks }: {
  open: boolean
  onClose: () => void
  onInsert: (blocks: PBlock[], mode: InsertMode) => void
  onApplySuggest?: (s: { title?: string; tags?: string[] }) => void
  existingBlocks?: PBlock[]
}) {
  const [text, setText] = React.useState('')
  const [phase, setPhase] = React.useState<'input' | 'review'>('input')
  const [blocks, setBlocks] = React.useState<PBlock[]>([])
  const [excluded, setExcluded] = React.useState<Set<string>>(() => new Set())
  const [insertMode, setInsertMode] = React.useState<InsertMode>('append')
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [cost, setCost] = React.useState<number | null>(null)
  const [suggest, setSuggest] = React.useState<{ title?: string; tags?: string[] } | null>(null)
  const [initialProposal, setInitialProposal] = React.useState<PBlock[]>([])
  const [log, setLog] = React.useState<Msg[]>([])
  const [feedback, setFeedback] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [stepIdx, setStepIdx] = React.useState(0)

  React.useEffect(() => {
    if (!loading) { setStepIdx(0); return }
    const id = setInterval(() => setStepIdx((i) => (i + 1) % LOADER_STEPS.length), 2200)
    return () => clearInterval(id)
  }, [loading])

  const reset = () => {
    setText(''); setPhase('input'); setBlocks([]); setExcluded(new Set()); setInsertMode('append')
    setEditingId(null); setCost(null); setSuggest(null); setInitialProposal([]); setLog([]); setFeedback(''); setError(null)
  }
  const close = () => { reset(); onClose() }

  const included = blocks.filter((b) => !excluded.has(b.id))
  const toggleExc = (id: string) => setExcluded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const removeBlock = (id: string) => { setBlocks((bs) => bs.filter((b) => b.id !== id)); if (editingId === id) setEditingId(null) }
  const moveBlock = (id: string, dir: -1 | 1) => setBlocks((bs) => {
    const i = bs.findIndex((b) => b.id === id); const j = i + dir
    if (i < 0 || j < 0 || j >= bs.length) return bs
    const n = [...bs]; const t = n[i]; n[i] = n[j]; n[j] = t; return n
  })
  const patchBlock = (id: string, p: Partial<PBlock>) => setBlocks((bs) => bs.map((b) => b.id === id ? ({ ...b, ...p } as PBlock) : b))

  async function call(body: Record<string, unknown>): Promise<boolean> {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/studio/api/compose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok || !j?.ok) {
        setError(j?.error || 'Не удалось обработать текст. Попробуйте ещё раз.')
        return false
      }
      const gotBlocks: PBlock[] = Array.isArray(j.blocks) ? j.blocks : []
      setBlocks(gotBlocks)
      if (!Array.isArray(body.messages) || (body.messages as unknown[]).length === 0) setInitialProposal(gotBlocks)
      setExcluded(new Set())
      if (typeof j.costRub === 'number') setCost(j.costRub)
      setSuggest(j.suggest && typeof j.suggest === 'object' ? j.suggest : null)
      setLog((l) => [...l, { role: 'assistant', content: String(j.note || 'Готово.') }])
      return true
    } catch {
      setError('Соединение прервалось — возможно, текст слишком длинный или сервис долго отвечал. Попробуйте ещё раз или разбейте текст на части.')
      return false
    } finally {
      setLoading(false)
    }
  }

  async function propose() {
    if (text.trim().length < 30) { setError('Вставьте текст — минимум 30 символов.'); return }
    const ok = await call({ text: text.trim(), messages: [], blocks: [], existing })
    if (ok) { setPhase('review') }
  }

  async function refine() {
    const f = feedback.trim()
    if (!f) return
    setLog((l) => [...l, { role: 'user', content: f }])
    setFeedback('')
    await call({ text: text.trim(), messages: [{ role: 'user', content: f }], blocks, existing })
  }

  const summarizeBlocks = (bs: PBlock[]) => bs.map((b) => `${BLOCK_LABEL[b.type]}${(b as { title?: string }).title ? ': ' + (b as { title?: string }).title : ''}`).join(', ')
  function sendComposeFeedbackIfChanged() {
    const before = summarizeBlocks(initialProposal)
    const after = summarizeBlocks(included)
    if (!before || !after || before === after) return
    fetch('/studio/api/compose/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ before, after }) }).catch(() => {})
  }

  if (!open || typeof document === 'undefined') return null

  const chars = text.trim().length
  const bigText = chars > 12000
  const existing = (existingBlocks || []).map((b) => ({ type: b.type, title: (b as { title?: string }).title || '' }))

  return createPortal(
    <div className="aic__overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) close() }}>
      <style dangerouslySetInnerHTML={{ __html: AIC_CSS }} />
      <div className="aic" role="dialog" aria-modal="true">
        <div className="aic__head">
          <div className="aic__title"><Sparkles size={18} /> Заполнить с помощью AI</div>
          <button type="button" className="aic__x" onClick={close} disabled={loading} title="Закрыть"><X size={18} /></button>
        </div>

        {phase === 'input' ? (
          <div className="aic__body">
            <p className="aic__hint">Вставьте текст статьи, биографии или обзора — ИИ разберёт его на блоки конструктора и предложит структуру. Текст переносится дословно, без сокращения. Результат увидите как превью до вставки.</p>
            <div className="aic__paid">Это отдельная услуга — оплачивается по тарифам (стоимость токенов списывается с депозита проекта; см. Настройки → Тариф).</div>
            <textarea
              className="studio-input aic__ta"
              rows={12}
              placeholder="Вставьте сюда большой текст…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={loading}
              autoFocus
            />
            {error && <div className="aic__err">{error}</div>}
            <div className="aic__actions">
              <span className="aic__count">
                {chars.toLocaleString('ru-RU')} симв.
                {chars >= 30 ? ` · ≈ ${rubFmt(estCostRub(chars))} (оценка)` : ''}
                {bigText ? ' · большой текст, разбор может занять до минуты' : ''}
              </span>
              <button type="button" className="studio-btn studio-btn--primary" disabled={loading} onClick={propose}>
                {loading ? <><Loader2 size={16} className="aic__spin" /> Разбираю…</> : <><Sparkles size={16} /> Предложить разбивку</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="aic__body">
            <div className="aic__chat">
              {log.map((m, i) => (
                <div key={i} className={`aic__msg aic__msg--${m.role}`}>{m.content}</div>
              ))}
            </div>

            <div className="aic__preview">
              <div className="aic__preview-h">
                <span><Eye size={14} /> Превью · выбрано {included.length} из {blocks.length}</span>
                {cost != null && <span className="aic__cost">разбор ≈ {rubFmt(cost)}</span>}
              </div>
              {blocks.length === 0 && <div className="aic__empty">Пусто — уточните текст или правку.</div>}
              <div className="aic__pvwrap">
                {blocks.map((b, i) => {
                  const off = excluded.has(b.id)
                  const editing = editingId === b.id
                  return (
                    <div key={b.id || i} className={`aic__pvblock${off ? ' is-off' : ''}`}>
                      <div className="aic__pvbar">
                        <label className="aic__pvchk">
                          <input type="checkbox" checked={!off} onChange={() => toggleExc(b.id)} />
                          <span className="aic__pv-kind2">{BLOCK_LABEL[b.type]}</span>
                        </label>
                        <div className="aic__pvctrls">
                          <button type="button" title="Выше" disabled={i === 0} onClick={() => moveBlock(b.id, -1)}><ArrowUp size={14} /></button>
                          <button type="button" title="Ниже" disabled={i === blocks.length - 1} onClick={() => moveBlock(b.id, 1)}><ArrowDown size={14} /></button>
                          <button type="button" title="Править текст" className={editing ? 'is-on' : ''} onClick={() => setEditingId(editing ? null : b.id)}><Pencil size={14} /></button>
                          <button type="button" title="Удалить" className="aic__delbtn" onClick={() => removeBlock(b.id)}><Trash2 size={14} /></button>
                        </div>
                      </div>
                      {editing
                        ? <BlockEditor b={b} patch={(p) => patchBlock(b.id, p)} />
                        : <div className="aic__pv-content"><BlockPreview b={b} /></div>}
                    </div>
                  )
                })}
              </div>
            </div>

            {suggest && (suggest.title || (suggest.tags && suggest.tags.length > 0)) && (
              <div className="aic__suggest">
                {suggest.title && <div className="aic__sg-row"><span className="aic__sg-lbl">Заголовок</span><span className="aic__sg-val">{suggest.title}</span></div>}
                {suggest.tags && suggest.tags.length > 0 && (
                  <div className="aic__sg-row"><span className="aic__sg-lbl">Теги</span><span className="aic__sg-tags">{suggest.tags.map((t, i) => <span key={i} className="aic__sg-tag">{t}</span>)}</span></div>
                )}
                <div className="aic__sg-actions">
                  {onApplySuggest && <button type="button" className="studio-btn studio-btn--ghost aic__sg-apply" onClick={() => onApplySuggest(suggest)}><Check size={14} /> Применить в поля публикации</button>}
                  <span className="aic__sg-note">Заголовок подставится, если поле пустое; теги добавятся к существующим.</span>
                </div>
              </div>
            )}

            {error && <div className="aic__err">{error}</div>}

            <div className="aic__refine">
              <textarea
                className="studio-input aic__fb"
                rows={2}
                placeholder="Правка: напр. «убери хронологию», «сделай два раздела», «выдели ключевое жирным»…"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                disabled={loading}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void refine() } }}
              />
              <button type="button" className="studio-btn studio-btn--ghost aic__send" disabled={loading || !feedback.trim()} onClick={() => void refine()}>
                {loading ? <Loader2 size={16} className="aic__spin" /> : <Send size={16} />}
              </button>
            </div>

            <div className="aic__mode">
              <label className={insertMode === 'append' ? 'is-on' : ''}><input type="radio" name="aicmode" checked={insertMode === 'append'} onChange={() => setInsertMode('append')} /> Добавить в конец</label>
              <label className={insertMode === 'replace' ? 'is-on' : ''}><input type="radio" name="aicmode" checked={insertMode === 'replace'} onChange={() => setInsertMode('replace')} /> Заменить страницу</label>
            </div>

            <div className="aic__actions aic__actions--split">
              <button type="button" className="studio-btn studio-btn--ghost" disabled={loading} onClick={reset}><ArrowLeft size={16} /> Заново</button>
              <button type="button" className="studio-btn studio-btn--primary" disabled={loading || included.length === 0} onClick={() => { sendComposeFeedbackIfChanged(); onInsert(included, insertMode); close() }}>
                <Check size={16} /> Вставить ({included.length})
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="aic__loader">
            <Loader2 size={30} className="aic__spin" />
            <div className="aic__loader-step">{LOADER_STEPS[stepIdx]}</div>
            <div className="aic__loader-hint">{bigText ? 'Большой текст — это может занять до минуты. Не закрывайте окно.' : 'Обычно занимает несколько секунд.'}</div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

const AIC_CSS = `
.aic__overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.5);display:grid;place-items:center;padding:20px}
.aic{font-family:var(--st-font-body,ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif);width:min(760px,96vw);max-height:92vh;display:flex;flex-direction:column;background:var(--st-surface);border:1px solid var(--st-border);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.4);overflow:hidden;position:relative}
.aic__head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--st-border)}
.aic__title{display:flex;align-items:center;gap:9px;font-weight:700;font-size:15px;color:var(--st-text)}
.aic__x{border:none;background:transparent;color:var(--st-text-muted);cursor:pointer;padding:4px;border-radius:8px}
.aic__x:hover{background:color-mix(in srgb,var(--st-text) 8%,transparent)}
.aic__x:disabled{opacity:.4;cursor:default}
.aic__body{padding:16px 18px;overflow:auto;display:flex;flex-direction:column;gap:12px}
.aic__hint{font-size:13px;color:var(--st-text-muted);line-height:1.5;margin:0}
.aic__paid{font-size:12.5px;color:var(--st-text);background:color-mix(in srgb,#2f6bed 8%,transparent);border:1px solid color-mix(in srgb,#2f6bed 20%,transparent);border-radius:10px;padding:9px 12px;line-height:1.45}
.aic__ta{resize:vertical;min-height:180px;font-family:inherit;line-height:1.5}
.aic__actions{display:flex;align-items:center;justify-content:flex-end;gap:12px}
.aic__actions--split{justify-content:space-between}
.aic__count{font-size:12px;color:var(--st-text-muted);margin-right:auto}
.aic__err{font-size:13px;color:#e5484d;background:color-mix(in srgb,#e5484d 10%,transparent);border:1px solid color-mix(in srgb,#e5484d 30%,transparent);border-radius:10px;padding:9px 12px;line-height:1.4}
.aic__chat{display:flex;flex-direction:column;gap:8px}
.aic__msg{font-size:13px;line-height:1.5;padding:10px 13px;border-radius:12px;max-width:92%;white-space:pre-wrap}
.aic__msg--assistant{align-self:flex-start;background:color-mix(in srgb,var(--st-accent) 10%,transparent);border:1px solid color-mix(in srgb,var(--st-accent) 22%,transparent);color:var(--st-text)}
.aic__msg--user{align-self:flex-end;background:color-mix(in srgb,var(--st-text) 7%,transparent);color:var(--st-text)}
.aic__preview{border:1px solid var(--st-border);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;background:color-mix(in srgb,var(--st-text) 2%,transparent)}
.aic__preview-h{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px;font-weight:700;color:var(--st-text-muted);padding:2px 2px}
.aic__preview-h span{display:inline-flex;align-items:center;gap:6px}
.aic__cost{color:#2f6bed}
.aic__empty{font-size:13px;color:var(--st-text-muted);padding:8px}
.aic__pvwrap{display:flex;flex-direction:column;gap:10px;max-height:42vh;overflow:auto;padding-right:4px}
.aic__pvblock{border:1px solid var(--st-border);border-radius:10px;background:var(--st-surface);overflow:hidden}
.aic__pvblock.is-off{opacity:.5}
.aic__pvbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px 6px 10px;border-bottom:1px solid var(--st-border);background:color-mix(in srgb,var(--st-text) 3%,transparent)}
.aic__pvchk{display:flex;align-items:center;gap:8px;cursor:pointer}
.aic__pvchk input{cursor:pointer}
.aic__pv-kind2{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#2f6bed}
.aic__pvctrls{display:flex;gap:2px}
.aic__pvctrls button{border:1px solid transparent;background:transparent;color:var(--st-text-muted);border-radius:7px;width:26px;height:26px;display:grid;place-items:center;cursor:pointer}
.aic__pvctrls button:hover:not(:disabled){background:color-mix(in srgb,var(--st-text) 8%,transparent);color:var(--st-text)}
.aic__pvctrls button:disabled{opacity:.35;cursor:default}
.aic__pvctrls button.is-on{color:#2f6bed;background:color-mix(in srgb,#2f6bed 12%,transparent)}
.aic__pvctrls .aic__delbtn:hover{color:#e5484d;background:color-mix(in srgb,#e5484d 12%,transparent)}
.aic__pv-content{padding:12px;font-size:13.5px;color:var(--st-text);line-height:1.55}
.aic__pv-content p{margin:0 0 8px}
.aic__pv-content p:last-child{margin-bottom:0}
.aic__pv-content h4{margin:6px 0;font-size:14.5px}
.aic__pv-content ul,.aic__pv-content ol{margin:4px 0;padding-left:20px}
.aic__pv-title{font-weight:700;font-size:14.5px;margin-bottom:6px;color:var(--st-text)}
.aic__pv-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#2f6bed;font-weight:700}
.aic__pv-sub{font-size:13px;color:var(--st-text-muted);margin:2px 0 6px}
.aic__pv-body{font-size:13.5px;line-height:1.55}
.aic__pv-facts{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px}
.aic__pv-fact{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed var(--st-border);padding-bottom:3px;font-size:13px}
.aic__pv-fact span{color:var(--st-text-muted)}
.aic__pv-tlrow{padding:4px 0;font-size:13.5px;border-bottom:1px dashed var(--st-border)}
.aic__pv-muted{color:var(--st-text-muted);font-size:12.5px;margin-top:2px}
.aic__pv-acc{padding:6px 0;border-bottom:1px dashed var(--st-border)}
.aic__pv-awards{display:flex;flex-direction:column;gap:4px}
.aic__pv-award{font-size:13.5px}
.aic__pv-ol{margin:0;padding-left:22px}
.aic__pv-ol li{margin:3px 0}
.aic__pv-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.aic__pv-quote{margin:0;padding:8px 14px;border-left:3px solid #2f6bed;background:color-mix(in srgb,#2f6bed 6%,transparent);border-radius:0 8px 8px 0;font-style:italic}
.aic__pv-quote cite{display:block;margin-top:4px;font-size:12px;color:var(--st-text-muted);font-style:normal}
.aic__pv-hr{border:none;border-top:1px solid var(--st-border);margin:2px 0}
.aic__pv-ph{font-size:13px;color:var(--st-text-muted);font-style:italic}
.aic__edit{padding:12px;display:flex;flex-direction:column;gap:8px}
.aic__edit .studio-input{width:100%}
.aic__edit-ta{resize:vertical;font-family:inherit;line-height:1.45;min-height:90px}
.aic__editnote{font-size:11.5px;color:var(--st-text-muted)}
.aic__refine{display:flex;gap:8px;align-items:flex-end}
.aic__fb{resize:vertical;flex:1;font-family:inherit;line-height:1.45}
.aic__send{flex:none;width:44px;justify-content:center}
.aic__suggest{border:1px solid color-mix(in srgb,#2f6bed 22%,transparent);background:color-mix(in srgb,#2f6bed 6%,transparent);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.aic__sg-row{display:flex;gap:10px;align-items:baseline;font-size:13px}
.aic__sg-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#2f6bed;min-width:70px}
.aic__sg-val{color:var(--st-text);font-weight:600}
.aic__sg-tags{display:flex;gap:6px;flex-wrap:wrap}
.aic__sg-tag{font-size:12px;background:color-mix(in srgb,var(--st-text) 8%,transparent);border-radius:999px;padding:2px 9px;color:var(--st-text)}
.aic__sg-note{font-size:11.5px;color:var(--st-text-muted)}
.aic__sg-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.aic__sg-apply{padding:5px 11px;font-size:12.5px}
.aic__mode{display:flex;gap:8px;flex-wrap:wrap}
.aic__mode label{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--st-text-muted);border:1px solid var(--st-border);border-radius:9px;padding:7px 12px;cursor:pointer}
.aic__mode label.is-on{border-color:#2f6bed;color:var(--st-text);background:color-mix(in srgb,#2f6bed 8%,transparent)}
.aic__spin{animation:aicspin 1s linear infinite}
@keyframes aicspin{to{transform:rotate(360deg)}}
.aic__loader{position:absolute;inset:0;background:color-mix(in srgb,var(--st-surface) 88%,transparent);backdrop-filter:blur(2px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--st-text);z-index:5}
.aic__loader-step{font-size:15px;font-weight:600}
.aic__loader-hint{font-size:12.5px;color:var(--st-text-muted);max-width:320px;text-align:center;line-height:1.4}
`
