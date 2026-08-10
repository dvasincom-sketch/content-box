'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X, Loader2, Check, FileText, ArrowUpRight, Trash2, Link as LinkIcon, Captions, Upload, Plus, Sparkles, List } from 'lucide-react'
import { StudioSelect } from '../_ui/StudioSelect'
import { TagInput } from '../_ui/TagInput'

type Tier = { id: number | string; name: string }

export type EditableVideo = {
  id: number | string
  title: string
  minTierId: string
  season: number | null
  episode: number | null
  categoryId: string
  tags: string[]
  usedIn: { id: number | string; title: string }[]
  /** 'stream' | 'kinescope' | 'embed' — у embed можно править исходную ссылку. */
  provider?: string
  embedProvider?: string | null
  embedSrc?: string | null
  playbackId?: string | null
  subtitles?: { lang: string; label: string }[]
  summary?: { tldr?: string; at?: string } | null
  chapters?: { start: number; title: string }[]
}

/**
 * Выдвижная панель редактирования видео (в стиле CategoryEditPanel).
 * Меняем название, уровень доступа, категорию/сезон/эпизод, теги. Для видео по
 * внешней ссылке (provider='embed') можно переввести исходную ссылку — сервер
 * её переразбирает (чинит ошибочный адрес). Внизу — удаление (блокируется,
 * если видео прикреплено к публикациям).
 *
 * Порталим в body: панель вызывается из строки таблицы видео, а у таблицы
 * overflow + стеклянные карточки/анимации создают stacking-контексты,
 * из-за которых fixed-оверлей иначе застревает внутри таблицы.
 */
export function VideoEditModal({
  video,
  tiers,
  onClose,
  onSaved,
}: {
  video: EditableVideo
  tiers: Tier[]
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(video.title)
  const [minTierId, setMinTierId] = useState<string>(video.minTierId || '')
  const [season, setSeason] = useState<string>(video.season != null ? String(video.season) : '')
  const [episode, setEpisode] = useState<string>(video.episode != null ? String(video.episode) : '')
  const [categoryId, setCategoryId] = useState<string>(video.categoryId || '')
  const [tags, setTags] = useState<string[]>(video.tags || [])
  const [embedUrl, setEmbedUrl] = useState('')
  const [categories, setCategories] = useState<{ id: number; title: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isEmbed = video.provider === 'embed'
  const inUse = video.usedIn.length > 0

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Список категорий тенанта — чтобы привязать видео к разделу / видео-плейлисту.
  useEffect(() => {
    let stop = false
    fetch('/studio/api/settings/categories-list', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (stop) return
        const list = Array.isArray(j.categories) ? j.categories : []
        setCategories(list.map((c: any) => ({ id: Number(c.id), title: String(c.title || '') })))
      })
      .catch(() => {})
    return () => {
      stop = true
    }
  }, [])

  async function save() {
    setError(null)
    if (!title.trim()) {
      setError('Название не может быть пустым')
      return
    }
    if (!isEmbed && !minTierId) {
      setError('Выберите уровень доступа — своё видео доступно только по подписке')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/studio/api/videos/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          videoId: video.id,
          title: title.trim(),
          minTierId: minTierId || null,
          season: season.trim() === '' ? null : Number(season),
          episode: episode.trim() === '' ? null : Number(episode),
          categoryId: categoryId || null,
          tags,
          // Меняем ссылку только у embed и только если её ввели.
          ...(isEmbed && embedUrl.trim() ? { embedUrl: embedUrl.trim() } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось сохранить')
        setSaving(false)
        return
      }
      onSaved()
    } catch {
      setError('Ошибка соединения')
      setSaving(false)
    }
  }

  async function doDelete() {
    setError(null)
    setDeleting(true)
    try {
      const res = await fetch('/studio/api/videos/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ videoId: video.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        // 409 = используется в публикациях (или иная причина) — показываем текст.
        setError(json.error || 'Не удалось удалить видео')
        setDeleting(false)
        setConfirmDel(false)
        return
      }
      onSaved()
    } catch {
      setError('Ошибка соединения')
      setDeleting(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <div className="studio-portal">
      <div className="catedit__overlay" onClick={onClose}>
        <div className="catedit" onClick={(e) => e.stopPropagation()}>
          <div className="catedit__head">
            <h3>Редактирование видео</h3>
            <button className="catmgr__icon-btn" onClick={onClose} title="Закрыть">
              <X size={18} />
            </button>
          </div>

          <div className="catedit__body">
            <div className="studio-field">
              <span className="studio-field__label">Название</span>
              <input
                className="studio-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            {isEmbed && (
              <div className="studio-field">
                <span className="studio-field__label">Ссылка на видео (VK / Дзен)</span>
                <input
                  className="studio-input"
                  value={embedUrl}
                  onChange={(e) => setEmbedUrl(e.target.value)}
                  placeholder="Вставьте новую ссылку или код <iframe>, чтобы исправить"
                />
                <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                  {video.embedSrc ? (
                    <>
                      <LinkIcon size={12} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }} />
                      Текущий адрес:{' '}
                      <span style={{ wordBreak: 'break-all' }}>{video.embedSrc}</span>
                      <br />
                    </>
                  ) : null}
                  Оставьте поле пустым, чтобы не менять ссылку. Новая ссылка будет заново разобрана и проверена.
                </div>
              </div>
            )}

            {isEmbed ? (
              <div className="studio-field">
                <span className="studio-field__label">Уровень доступа</span>
                <div className="videdit__hint" style={{ fontSize: 13, opacity: 0.8 }}>
                  Внешнее видео доступно всем бесплатно — закрыть его подпиской
                  нельзя (плеер грузится с чужого домена).
                </div>
              </div>
            ) : (
              <div className="studio-field">
                <span className="studio-field__label">Уровень доступа</span>
                <StudioSelect
                  value={minTierId}
                  onChange={setMinTierId}
                  options={[
                    { value: '', label: tiers.length ? '— выберите уровень —' : 'Сначала создайте уровень подписки' },
                    ...tiers.map((t) => ({ value: String(t.id), label: `${t.name} и выше` })),
                  ]}
                  ariaLabel="Уровень доступа"
                />
                <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                  Своё видео доступно только по подписке.
                </div>
              </div>
            )}

            <div className="studio-field">
              <span className="studio-field__label">Категория (раздел / видео-плейлист)</span>
              <StudioSelect
                value={categoryId}
                onChange={setCategoryId}
                options={[
                  { value: '', label: '— без категории —' },
                  ...categories.map((c) => ({ value: String(c.id), label: c.title })),
                ]}
                ariaLabel="Категория"
              />
              <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                Чтобы видео попало в плейлист, выберите категорию с типом «Видео-плейлист» и задайте сезон/эпизод ниже.
              </div>
            </div>

            <div className="studio-field">
              <span className="studio-field__label">Сезон и эпизод (для видео-плейлиста)</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="studio-input"
                  type="number"
                  min={0}
                  placeholder="Сезон"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                />
                <input
                  className="studio-input"
                  type="number"
                  min={0}
                  placeholder="Эпизод"
                  value={episode}
                  onChange={(e) => setEpisode(e.target.value)}
                />
              </div>
            </div>

            <div className="studio-field">
              <span className="studio-field__label">Теги</span>
              <TagInput value={tags} onChange={setTags} placeholder="Тег и Enter" />
            </div>

            {video.provider === 'self' && (
              <SubtitlesSection videoId={video.id} playbackId={video.playbackId ?? null} initial={video.subtitles || []} />
            )}

            {video.provider === 'self' && <AnalyticsSection videoId={video.id} />}

            {video.provider === 'self' && <SummarySection videoId={video.id} initial={video.summary ?? null} hasSubtitles={(video.subtitles || []).length > 0} />}

            {video.provider === 'self' && <ChaptersSection videoId={video.id} initial={video.chapters || []} />}

            {error && <div className="studio-login__error">{error}</div>}

            <div className="videdit__used">
              <div className="videdit__used-label">Используется в публикациях</div>
              {video.usedIn.length === 0 ? (
                <div className="videdit__used-empty">Не прикреплено ни к одной публикации</div>
              ) : (
                <ul className="videdit__used-list">
                  {video.usedIn.map((p) => (
                    <li key={p.id}>
                      <Link href={`/studio/posts/${p.id}`} className="videdit__used-link" onClick={onClose}>
                        <FileText size={14} className="videdit__used-icon" />
                        <span className="videdit__used-title">{p.title}</span>
                        <ArrowUpRight size={14} className="videdit__used-arrow" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Удаление видео. Блокируем, если прикреплено к публикациям. */}
            <div
              className="videdit__danger"
              style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--st-border, rgba(0,0,0,.1))' }}
            >
              {inUse ? (
                <div style={{ fontSize: 13, color: 'var(--brand-muted)' }}>
                  Удаление недоступно: видео используется в публикациях ({video.usedIn.length}).
                  Сначала открепите его в этих публикациях.
                </div>
              ) : confirmDel ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13 }}>Удалить видео безвозвратно?</span>
                  <button
                    className="studio-btn studio-btn--danger"
                    onClick={doDelete}
                    disabled={deleting}
                  >
                    {deleting ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                    Удалить
                  </button>
                  <button
                    className="studio-btn studio-btn--ghost"
                    onClick={() => setConfirmDel(false)}
                    disabled={deleting}
                  >
                    Отмена
                  </button>
                </div>
              ) : (
                <button
                  className="studio-btn studio-btn--ghost"
                  onClick={() => setConfirmDel(true)}
                  style={{ color: 'var(--st-danger, #c0392b)' }}
                >
                  <Trash2 size={16} />
                  Удалить видео
                </button>
              )}
            </div>
          </div>

          <div className="catedit__foot">
            <button className="studio-btn studio-btn--ghost" onClick={onClose}>
              Отмена
            </button>
            <button className="studio-btn studio-btn--primary" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* -------------------------------------------------------------------------- */
/* Субтитры своего видео: загрузка VTT/SRT + список дорожек                     */
/* -------------------------------------------------------------------------- */
function SubtitlesSection({
  videoId,
  playbackId,
  initial,
}: {
  videoId: number | string
  playbackId: string | null
  initial: { lang: string; label: string }[]
}) {
  const [tracks, setTracks] = useState<{ lang: string; label: string }[]>(initial)
  const [lang, setLang] = useState('')
  const [label, setLabel] = useState('')
  const [content, setContent] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [gen, setGen] = useState<'idle' | 'busy' | 'queued'>('idle')

  async function genAuto() {
    setErr(null); setGen('busy')
    try {
      const res = await fetch('/studio/api/videos/subtitles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ videoId, action: 'generate' }),
      })
      const j = await res.json()
      if (!res.ok) { setErr(j.error || 'Не удалось'); setGen('idle') }
      else setGen('queued')
    } catch { setErr('Ошибка соединения'); setGen('idle') }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setErr('Файл больше 2 МБ'); return }
    const text = await file.text()
    setContent(text)
    setFileName(file.name)
    if (!lang) { const m = file.name.toLowerCase().match(/[._-]([a-z]{2,3})\.(vtt|srt)$/); if (m) setLang(m[1]) }
    setErr(null)
  }

  async function add() {
    setErr(null)
    if (!content) { setErr('Выберите файл .vtt или .srt'); return }
    if (!/^[a-z]{2,3}(-[a-z]{2,4})?$/.test(lang.trim().toLowerCase())) { setErr('Код языка: ru, en, pt-br…'); return }
    setBusy(true)
    try {
      const res = await fetch('/studio/api/videos/subtitles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ videoId, action: 'add', lang: lang.trim().toLowerCase(), label: label.trim(), content }),
      })
      const j = await res.json()
      if (!res.ok) setErr(j.error || 'Не удалось сохранить')
      else { setTracks(j.subtitles || []); setContent(null); setFileName(''); setLang(''); setLabel('') }
    } catch { setErr('Ошибка соединения') } finally { setBusy(false) }
  }

  async function remove(l: string) {
    setBusy(true)
    try {
      const res = await fetch('/studio/api/videos/subtitles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ videoId, action: 'remove', lang: l }),
      })
      const j = await res.json()
      if (res.ok) setTracks(j.subtitles || [])
    } catch { /* no-op */ } finally { setBusy(false) }
  }

  return (
    <div className="studio-field">
      <span className="studio-field__label">Субтитры</span>
      {!playbackId ? (
        <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7 }}>Дорожки можно добавить, когда видео обработается.</div>
      ) : (
        <>
          {tracks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {tracks.map((t) => (
                <div key={t.lang} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Captions size={14} />
                  <span style={{ fontSize: 13 }}>{t.label} <span style={{ opacity: 0.6 }}>({t.lang})</span></span>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="catmgr__icon-btn catmgr__icon-btn--danger" onClick={() => remove(t.lang)} disabled={busy} title="Удалить"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <label className="studio-btn studio-btn--ghost" style={{ cursor: 'pointer' }}>
              <Upload size={14} /> {fileName || 'Файл .vtt / .srt'}
              <input type="file" accept=".vtt,.srt,text/vtt" onChange={onFile} style={{ display: 'none' }} />
            </label>
            <input className="studio-input" style={{ width: 90 }} placeholder="ru" value={lang} onChange={(e) => setLang(e.target.value)} />
            <input className="studio-input" style={{ width: 150 }} placeholder="Русские" value={label} onChange={(e) => setLabel(e.target.value)} />
            <button type="button" className="studio-btn studio-btn--primary" onClick={add} disabled={busy || !content}>
              {busy ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Добавить
            </button>
          </div>
          {err && <div className="studio-login__error" style={{ marginTop: 6 }}>{err}</div>}
          <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Формат VTT или SRT (SRT конвертируется автоматически). Код языка — ru, en и т.п.</div>

          <div style={{ borderTop: '1px solid var(--brand-border, rgba(128,128,128,.2))', margin: '12px 0 8px' }} />
          {gen === 'queued' ? (
            <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.85 }}>
              <Check size={13} style={{ verticalAlign: '-2px' }} /> Задача поставлена — субтитры и главы появятся через несколько минут (обновите позже).
            </div>
          ) : (
            <>
              <button type="button" className="studio-btn studio-btn--ghost" onClick={genAuto} disabled={gen === 'busy'}>
                {gen === 'busy' ? <Loader2 size={14} className="spin" /> : <Captions size={14} />} Сгенерировать автоматически (Whisper)
              </button>
              <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Распознаём речь и делаем субтитры + главы. Работает и для старых видео (аудио берётся из HLS).</div>
            </>
          )}
        </>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Аналитика просмотров своего видео: кривая удержания / тепловая карта         */
/* -------------------------------------------------------------------------- */
function AnalyticsSection({ videoId }: { videoId: number | string }) {
  const [data, setData] = useState<{ buckets: number[]; starts: number; plays: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let stop = false
    fetch(`/studio/api/videos/heatmap?videoId=${videoId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (!stop && Array.isArray(j?.buckets)) setData({ buckets: j.buckets, starts: j.starts || 0, plays: j.plays || 0 }) })
      .catch(() => {})
      .finally(() => { if (!stop) setLoading(false) })
    return () => { stop = true }
  }, [videoId])

  const max = data ? Math.max(1, ...data.buckets) : 1
  const avgPct = data && data.starts > 0 ? Math.round(data.plays / data.starts) : 0
  const at = (p: number) => (data && data.starts > 0 ? Math.round((data.buckets[p] / data.starts) * 100) : 0)

  return (
    <div className="studio-field">
      <span className="studio-field__label">Аналитика просмотров</span>
      {loading ? (
        <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7 }}>Загрузка…</div>
      ) : !data || data.starts === 0 ? (
        <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7 }}>Пока нет данных о просмотрах. Появятся, когда видео начнут смотреть.</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 10 }}>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>{data.starts}</div><div style={{ fontSize: 12, opacity: 0.7 }}>запусков</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>{avgPct}%</div><div style={{ fontSize: 12, opacity: 0.7 }}>ср. досмотр</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>{at(50)}%</div><div style={{ fontSize: 12, opacity: 0.7 }}>до середины</div></div>
            <div><div style={{ fontSize: 18, fontWeight: 700 }}>{at(99)}%</div><div style={{ fontSize: 12, opacity: 0.7 }}>до конца</div></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 64, background: 'var(--surface-2, rgba(128,128,128,0.08))', borderRadius: 8, padding: '6px 6px 0', overflow: 'hidden' }}>
            {data.buckets.map((v, i) => (
              <div key={i} title={`${i}% — ${v}`} style={{ flex: 1, height: `${Math.max(3, (v / max) * 100)}%`, background: 'var(--brand-primary, #7c3aed)', opacity: 0.35 + 0.65 * (v / max), borderRadius: '2px 2px 0 0' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.6, marginTop: 4 }}>
            <span>начало</span><span>середина</span><span>конец</span>
          </div>
          <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Высота столбца — как часто смотрят этот участок. Провалы — где перематывают или уходят.</div>
        </>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Саммари от Аси: (пере)генерация краткого содержания по субтитрам             */
/* -------------------------------------------------------------------------- */
function SummarySection({ videoId, initial, hasSubtitles }: { videoId: number | string; initial: { tldr?: string; at?: string } | null; hasSubtitles: boolean }) {
  const [summary, setSummary] = useState<{ tldr?: string; at?: string } | null>(initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function refresh() {
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/studio/api/videos/summarize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ videoId }),
      })
      const j = await res.json()
      if (!res.ok) setErr(j.error || 'Не удалось')
      else setSummary(j.summary)
    } catch { setErr('Ошибка соединения') } finally { setBusy(false) }
  }

  return (
    <div className="studio-field">
      <span className="studio-field__label">Саммари от Аси</span>
      {summary?.tldr ? (
        <div className="videdit__hint" style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>{summary.tldr}</div>
      ) : (
        <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>{hasSubtitles ? 'Саммари ещё не сгенерировано.' : 'Саммари появится, когда будут субтитры.'}</div>
      )}
      <button type="button" className="studio-btn studio-btn--ghost" onClick={refresh} disabled={busy || !hasSubtitles} title={!hasSubtitles ? 'Сначала нужны субтитры' : undefined}>
        {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} {summary?.tldr ? 'Обновить саммари' : 'Сгенерировать саммари'}
      </button>
      <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        {hasSubtitles
          ? 'Ася делает краткое содержание по субтитрам. Обновите после смены или дозагрузки субтитров.'
          : 'Сначала сгенерируйте автоматические субтитры или загрузите файл выше — затем можно собрать саммари.'}
      </div>
      {err && <div className="studio-login__error" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Главы: полировка авто-заголовков через Асю                                  */
/* -------------------------------------------------------------------------- */
function fmtTs(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function ChaptersSection({ videoId, initial }: { videoId: number | string; initial: { start: number; title: string }[] }) {
  const [chapters, setChapters] = useState<{ start: number; title: string }[]>(initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const hasChapters = chapters.length >= 2

  async function polish() {
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/studio/api/videos/polish-chapters', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ videoId }),
      })
      const j = await res.json()
      if (!res.ok) setErr(j.error || 'Не удалось')
      else if (Array.isArray(j.chapters)) setChapters(j.chapters)
    } catch { setErr('Ошибка соединения') } finally { setBusy(false) }
  }

  return (
    <div className="studio-field">
      <span className="studio-field__label">Главы</span>
      {hasChapters ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {chapters.slice(0, 12).map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, opacity: 0.9 }}>
              <span style={{ opacity: 0.55, minWidth: 42 }}>{fmtTs(c.start)}</span>
              <span>{c.title}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Главы появятся после генерации субтитров (Whisper).</div>
      )}
      <button type="button" className="studio-btn studio-btn--ghost" onClick={polish} disabled={busy || !hasChapters} title={!hasChapters ? 'Сначала нужны субтитры и главы' : undefined}>
        {busy ? <Loader2 size={14} className="spin" /> : <List size={14} />} Улучшить названия глав (Ася)
      </button>
      <div className="videdit__hint" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
        Авто-главы берут первую фразу из распознанной речи — Ася заменит их короткими осмысленными заголовками. Тайминги не меняются.
      </div>
      {err && <div className="studio-login__error" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  )
}
