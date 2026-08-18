'use client'
import React from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X, Send, Loader2, ArrowLeft, Check } from 'lucide-react'
import { BLOCK_LABEL, type PBlock } from '@/lib/profileBlocks'

/**
 * Модалка «Заполнить с помощью AI»: автор вставляет сплошной текст, Ася
 * (capability compose) предлагает разбивку на блоки, автор правит её в диалоге,
 * по подтверждению блоки уходят в конструктор через onInsert.
 */

type Msg = { role: 'assistant' | 'user'; content: string }

/** Короткое человекочитаемое превью содержимого блока для списка предложений. */
function previewOf(b: PBlock): string {
  const anyB = b as any
  switch (b.type) {
    case 'hero': return [anyB.eyebrow, anyB.subtitle, anyB.lead].filter(Boolean).join(' · ').slice(0, 120)
    case 'text': return String(anyB.body || '').replace(/[#*_>-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140)
    case 'facts': return (anyB.items || []).map((f: any) => `${f.label}: ${f.value}`).join(' · ').slice(0, 140)
    case 'timeline': return (anyB.items || []).map((t: any) => `${t.year} ${t.title}`).join(' · ').slice(0, 140)
    case 'relations': return (anyB.items || []).map((r: any) => r.name).filter(Boolean).join(' · ').slice(0, 140)
    case 'awards': return (anyB.items || []).map((a: any) => a.title).filter(Boolean).join(' · ').slice(0, 140)
    case 'factsList': return (anyB.items || []).join(' · ').slice(0, 140)
    case 'columns': return (anyB.cols || []).map((c: any) => c.title || (c.body || '').slice(0, 30)).join(' | ').slice(0, 140)
    case 'callout': return String(anyB.text || '').replace(/[#*_>-]/g, '').slice(0, 140)
    case 'button': return anyB.label || 'кнопка'
    case 'divider': return 'разделитель'
    default: return 'пустой блок — заполните вручную'
  }
}

export function AiComposeModal({ open, onClose, onInsert }: {
  open: boolean
  onClose: () => void
  onInsert: (blocks: PBlock[]) => void
}) {
  const [text, setText] = React.useState('')
  const [phase, setPhase] = React.useState<'input' | 'review'>('input')
  const [blocks, setBlocks] = React.useState<PBlock[]>([])
  const [log, setLog] = React.useState<Msg[]>([])
  const [feedback, setFeedback] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const reset = () => { setText(''); setPhase('input'); setBlocks([]); setLog([]); setFeedback(''); setError(null) }
  const close = () => { reset(); onClose() }

  async function call(body: Record<string, unknown>): Promise<boolean> {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/studio/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok || !j?.ok) {
        setError(j?.error || 'Не удалось обработать текст. Попробуйте ещё раз.')
        return false
      }
      setBlocks(Array.isArray(j.blocks) ? j.blocks : [])
      setLog((l) => [...l, { role: 'assistant', content: String(j.note || 'Готово.') }])
      return true
    } catch {
      setError('Ошибка сети. Попробуйте ещё раз.')
      return false
    } finally {
      setLoading(false)
    }
  }

  async function propose() {
    if (text.trim().length < 30) { setError('Вставьте текст — минимум 30 символов.'); return }
    const ok = await call({ text: text.trim(), messages: [], blocks: [] })
    if (ok) setPhase('review')
  }

  async function refine() {
    const f = feedback.trim()
    if (!f) return
    setLog((l) => [...l, { role: 'user', content: f }])
    setFeedback('')
    await call({ text: text.trim(), messages: [{ role: 'user', content: f }], blocks })
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="aic__overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <style dangerouslySetInnerHTML={{ __html: AIC_CSS }} />
      <div className="aic" role="dialog" aria-modal="true">
        <div className="aic__head">
          <div className="aic__title"><Sparkles size={18} /> Заполнить с помощью AI</div>
          <button type="button" className="aic__x" onClick={close} title="Закрыть"><X size={18} /></button>
        </div>

        {phase === 'input' ? (
          <div className="aic__body">
            <p className="aic__hint">Вставьте текст статьи, биографии или обзора — ИИ разберёт его на блоки конструктора и предложит структуру. Вы сможете поправить результат в диалоге до вставки.</p>
            <textarea
              className="studio-input aic__ta"
              rows={12}
              placeholder="Вставьте сюда большой текст…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
            {error && <div className="aic__err">{error}</div>}
            <div className="aic__actions">
              <span className="aic__count">{text.trim().length} симв.</span>
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
              <div className="aic__preview-h">Предложено блоков: {blocks.length}</div>
              {blocks.length === 0 && <div className="aic__empty">Пусто — уточните текст или правку.</div>}
              {blocks.map((b, i) => (
                <div key={b.id || i} className="aic__pv">
                  <span className="aic__pv-kind">{BLOCK_LABEL[b.type]}</span>
                  <span className="aic__pv-text">{previewOf(b)}</span>
                </div>
              ))}
            </div>

            {error && <div className="aic__err">{error}</div>}

            <div className="aic__refine">
              <textarea
                className="studio-input aic__fb"
                rows={2}
                placeholder="Правка: напр. «убери хронологию», «сделай два раздела», «выдели ключевое жирным»…"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void refine() } }}
              />
              <button type="button" className="studio-btn studio-btn--ghost aic__send" disabled={loading || !feedback.trim()} onClick={() => void refine()}>
                {loading ? <Loader2 size={16} className="aic__spin" /> : <Send size={16} />}
              </button>
            </div>

            <div className="aic__actions aic__actions--split">
              <button type="button" className="studio-btn studio-btn--ghost" disabled={loading} onClick={reset}><ArrowLeft size={16} /> Заново</button>
              <button type="button" className="studio-btn studio-btn--primary" disabled={loading || blocks.length === 0} onClick={() => { onInsert(blocks); close() }}>
                <Check size={16} /> Вставить в страницу
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

const AIC_CSS = `
.aic__overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.5);display:grid;place-items:center;padding:20px}
.aic{font-family:var(--st-font-body,ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif);width:min(720px,96vw);max-height:92vh;display:flex;flex-direction:column;background:var(--st-surface);border:1px solid var(--st-border);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.4);overflow:hidden}
.aic__head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--st-border)}
.aic__title{display:flex;align-items:center;gap:9px;font-weight:700;font-size:15px;color:var(--st-text)}
.aic__x{border:none;background:transparent;color:var(--st-text-muted);cursor:pointer;padding:4px;border-radius:8px}
.aic__x:hover{background:color-mix(in srgb,var(--st-text) 8%,transparent)}
.aic__body{padding:16px 18px;overflow:auto;display:flex;flex-direction:column;gap:12px}
.aic__hint{font-size:13px;color:var(--st-text-muted);line-height:1.5;margin:0}
.aic__ta{resize:vertical;min-height:180px;font-family:inherit;line-height:1.5}
.aic__actions{display:flex;align-items:center;justify-content:flex-end;gap:12px}
.aic__actions--split{justify-content:space-between}
.aic__count{font-size:12px;color:var(--st-text-muted);margin-right:auto}
.aic__err{font-size:13px;color:#e5484d;background:color-mix(in srgb,#e5484d 10%,transparent);border:1px solid color-mix(in srgb,#e5484d 30%,transparent);border-radius:10px;padding:9px 12px}
.aic__chat{display:flex;flex-direction:column;gap:8px}
.aic__msg{font-size:13px;line-height:1.5;padding:10px 13px;border-radius:12px;max-width:92%;white-space:pre-wrap}
.aic__msg--assistant{align-self:flex-start;background:color-mix(in srgb,var(--st-accent) 10%,transparent);border:1px solid color-mix(in srgb,var(--st-accent) 22%,transparent);color:var(--st-text)}
.aic__msg--user{align-self:flex-end;background:color-mix(in srgb,var(--st-text) 7%,transparent);color:var(--st-text)}
.aic__preview{border:1px solid var(--st-border);border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:6px;background:color-mix(in srgb,var(--st-text) 2%,transparent)}
.aic__preview-h{font-size:12px;font-weight:700;color:var(--st-text-muted);padding:2px 4px}
.aic__empty{font-size:13px;color:var(--st-text-muted);padding:8px}
.aic__pv{display:flex;gap:10px;align-items:baseline;padding:7px 9px;border-radius:9px;background:var(--st-surface);border:1px solid var(--st-border)}
.aic__pv-kind{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#2f6bed;background:color-mix(in srgb,#2f6bed 12%,transparent);border-radius:999px;padding:2px 8px;flex:none}
.aic__pv-text{font-size:12.5px;color:var(--st-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aic__refine{display:flex;gap:8px;align-items:flex-end}
.aic__fb{resize:vertical;flex:1;font-family:inherit;line-height:1.45}
.aic__send{flex:none;width:44px;justify-content:center}
.aic__spin{animation:aicspin 1s linear infinite}
@keyframes aicspin{to{transform:rotate(360deg)}}
`
