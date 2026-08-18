'use client'
import React from 'react'
import { Sparkles, FileText, Captions, MessageCircle, Info } from 'lucide-react'
import type { AiUsageStats, AiSurfaceKey, AiSurfaceStat } from '@/lib/aiUsageStats'

/**
 * Вкладка «AI»: нагрузка ассистента Аси по тенанту — где используется и сколько
 * токенов тратится. Три поверхности + итог. Токены пока оценочные (по длине
 * текста), о чём честно сообщаем.
 */

const SURFACES: { key: AiSurfaceKey; label: string; hint: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'compose', label: 'Создание страниц', hint: 'Разбор текста на блоки конструктора', Icon: FileText },
  { key: 'summary', label: 'Саммари субтитров', hint: 'Краткое содержание видео по субтитрам', Icon: Captions },
  { key: 'support', label: 'Поддержка на сайте', hint: 'Ответы Аси авторизованным зрителям', Icon: MessageCircle },
]

function fmt(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n || 0))
}

function SurfaceCard({ label, hint, Icon, stat }: { label: string; hint: string; Icon: React.ComponentType<{ size?: number }>; stat: AiSurfaceStat }) {
  return (
    <div className="aiu__card">
      <div className="aiu__card-head"><span className="aiu__ico"><Icon size={16} /></span><b>{label}</b></div>
      <div className="aiu__hint">{hint}</div>
      <div className="aiu__nums">
        <div className="aiu__num"><span className="aiu__val">{fmt(stat.tokens)}</span><span className="aiu__lbl">токенов всего</span></div>
        <div className="aiu__num"><span className="aiu__val">{fmt(stat.calls)}</span><span className="aiu__lbl">вызовов</span></div>
      </div>
      <div className="aiu__sub">За 30 дней: {fmt(stat.tokens30)} токенов · {fmt(stat.calls30)} вызовов</div>
    </div>
  )
}

export function AiUsagePanel({ data }: { data: AiUsageStats | null }) {
  const empty: AiSurfaceStat = { calls: 0, tokens: 0, calls30: 0, tokens30: 0 }
  const total = data?.total ?? empty
  const bySurface = data?.bySurface

  return (
    <section className="settings__block aiu">
      <style dangerouslySetInnerHTML={{ __html: AIU_CSS }} />
      <div className="aiu__title"><Sparkles size={18} /> Ассистент Ася — нагрузка</div>
      <p className="aiu__lead">Где в проекте используется ИИ-ассистент и сколько токенов расходуется. Помогает понять нагрузку и стоимость.</p>

      <div className="aiu__total">
        <div className="aiu__total-item"><span className="aiu__total-val">{fmt(total.tokens)}</span><span className="aiu__total-lbl">токенов всего</span></div>
        <div className="aiu__total-item"><span className="aiu__total-val">{fmt(total.calls)}</span><span className="aiu__total-lbl">вызовов всего</span></div>
        <div className="aiu__total-item"><span className="aiu__total-val">{fmt(total.tokens30)}</span><span className="aiu__total-lbl">токенов за 30 дней</span></div>
      </div>

      <div className="aiu__grid">
        {SURFACES.map((s) => (
          <SurfaceCard key={s.key} label={s.label} hint={s.hint} Icon={s.Icon} stat={bySurface?.[s.key] ?? empty} />
        ))}
      </div>

      {(!data || total.calls === 0) && (
        <div className="aiu__empty">Пока нет данных — счётчик наполнится, как только Ася поработает: разберёт текст на странице, сделает саммари видео или ответит зрителю.</div>
      )}

      <div className="aiu__note"><Info size={14} /> Токены — оценка по длине текста (Ася пока не возвращает точный расход). Порядок величины верный; поле готово принять точные значения позже.</div>
    </section>
  )
}

const AIU_CSS = `
.aiu__title{display:flex;align-items:center;gap:9px;font-weight:700;font-size:16px;color:var(--st-text);margin-bottom:6px}
.aiu__lead{font-size:13px;color:var(--st-text-muted);line-height:1.5;margin:0 0 16px}
.aiu__total{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px}
.aiu__total-item{flex:1;min-width:150px;background:color-mix(in srgb,var(--st-accent) 8%,transparent);border:1px solid color-mix(in srgb,var(--st-accent) 20%,transparent);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:3px}
.aiu__total-val{font-size:24px;font-weight:800;color:var(--st-text);line-height:1.1}
.aiu__total-lbl{font-size:12px;color:var(--st-text-muted)}
.aiu__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.aiu__card{border:1px solid var(--st-border);border-radius:12px;padding:14px;background:var(--st-surface);display:flex;flex-direction:column;gap:8px}
.aiu__card-head{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--st-text)}
.aiu__ico{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:color-mix(in srgb,#2f6bed 12%,transparent);color:#2f6bed;flex:none}
.aiu__hint{font-size:12px;color:var(--st-text-muted);line-height:1.4;min-height:32px}
.aiu__nums{display:flex;gap:16px;margin-top:2px}
.aiu__num{display:flex;flex-direction:column}
.aiu__val{font-size:19px;font-weight:800;color:var(--st-text);line-height:1.15}
.aiu__lbl{font-size:11.5px;color:var(--st-text-muted)}
.aiu__sub{font-size:12px;color:var(--st-text-muted);border-top:1px dashed var(--st-border);padding-top:8px;margin-top:2px}
.aiu__empty{font-size:13px;color:var(--st-text-muted);background:color-mix(in srgb,var(--st-text) 3%,transparent);border:1px dashed var(--st-border);border-radius:12px;padding:14px;margin-top:14px;line-height:1.5}
.aiu__note{display:flex;align-items:flex-start;gap:7px;font-size:12px;color:var(--st-text-muted);line-height:1.45;margin-top:14px}
.aiu__note svg{flex:none;margin-top:2px}
`
