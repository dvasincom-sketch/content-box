'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Check, FileText, ArrowUpRight, Trash2, Link as LinkIcon, Info, Captions, List, BarChart3, Sparkles } from 'lucide-react'
import { StudioSelect } from '../../_ui/StudioSelect'
import { TagInput } from '../../_ui/TagInput'
import {
  SubtitlesSection,
  AnalyticsSection,
  SummarySection,
  ChaptersSection,
  type EditableVideo,
  type Tier,
} from '../VideoSections'

/**
 * Страница-редактор видео (/studio/videos/<id>) с меню-табами, по образцу
 * редактора публикаций. Заменяет прежнюю выдвижную панель. «Обзор» — основные
 * поля и удаление; остальные табы (Субтитры / Главы / Аналитика / Саммари)
 * доступны только для своего видео (provider='self').
 */

type TabKey = 'overview' | 'subtitles' | 'chapters' | 'analytics' | 'summary'

export function VideoEditor({ video, tiers }: { video: EditableVideo; tiers: Tier[] }) {
  const router = useRouter()

  const isEmbed = video.provider === 'embed'
  const isSelf = video.provider === 'self'
  const inUse = video.usedIn.length > 0

  const TABS: { key: TabKey; label: string; icon: React.ReactNode; self?: boolean }[] = [
    { key: 'overview', label: 'Обзор', icon: <Info size={15} /> },
    { key: 'subtitles', label: 'Субтитры', icon: <Captions size={15} />, self: true },
    { key: 'chapters', label: 'Главы', icon: <List size={15} />, self: true },
    { key: 'analytics', label: 'Аналитика', icon: <BarChart3 size={15} />, self: true },
    { key: 'summary', label: 'Саммари', icon: <Sparkles size={15} />, self: true },
  ]
  const tabs = TABS.filter((t) => !t.self || isSelf)
  const [tab, setTab] = useState<TabKey>('overview')

  // — Основные поля («Обзор») —
  const [title, setTitle] = useState(video.title)
  const [minTierId, setMinTierId] = useState<string>(video.minTierId || '')
  const [season, setSeason] = useState<string>(video.season != null ? String(video.season) : '')
  const [episode, setEpisode] = useState<string>(video.episode != null ? String(video.episode) : '')
  const [categoryId, setCategoryId] = useState<string>(video.categoryId || '')
  const [tags, setTags] = useState<string[]>(video.tags || [])
  const [embedUrl, setEmbedUrl] = useState('')
  const [categories, setCategories] = useState<{ id: number; title: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
    return () => { stop = true }
  }, [])

  async function save() {
    setError(null); setSavedOk(false)
    if (!title.trim()) { setError('Название не может быть пустым'); return }
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
          ...(isEmbed && embedUrl.trim() ? { embedUrl: embedUrl.trim() } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Не удалось сохранить'); setSaving(false); return }
      setSavedOk(true)
      setSaving(false)
      router.refresh()
    } catch {
      setError('Ошибка соединения'); setSaving(false)
    }
  }

  async function doDelete() {
    setError(null); setDeleting(true)
    try {
      const res = await fetch('/studio/api/videos/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ videoId: video.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Не удалось удалить видео')
        setDeleting(false); setConfirmDel(false)
        return
      }
      router.push('/studio/videos')
      router.refresh()
    } catch {
      setError('Ошибка соединения'); setDeleting(false)
    }
  }

  return (
    <div className="vidpage">
      <div className="vidpage__top">
        <Link href="/studio/videos" className="vidpage__back">
          <ArrowLeft size={16} /> К списку видео
        </Link>
      </div>

      <div className="studio-page-head vidpage__head">
        <div>
          <h1 className="vidpage__title">{title || 'Видео'}</h1>
          <div className="studio-page-head__sub">
            {isSelf ? 'Своё видео' : isEmbed ? 'Внешнее видео' : 'Видео'}
          </div>
        </div>
      </div>

      {/* Меню-табы */}
      <div className="vidtabs" role="tablist" aria-label="Разделы редактора видео">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`vidtabs__tab${tab === t.key ? ' is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="vidpage__panel">
        {tab === 'overview' && (
          <div className="vidpage__overview">
            <div className="studio-field">
              <span className="studio-field__label">Название</span>
              <input className="studio-input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
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
                      Текущий адрес: <span style={{ wordBreak: 'break-all' }}>{video.embedSrc}</span>
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
                  Внешнее видео доступно всем бесплатно — закрыть его подпиской нельзя (плеер грузится с чужого домена).
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
                <input className="studio-input" type="number" min={0} placeholder="Сезон" value={season} onChange={(e) => setSeason(e.target.value)} />
                <input className="studio-input" type="number" min={0} placeholder="Эпизод" value={episode} onChange={(e) => setEpisode(e.target.value)} />
              </div>
            </div>

            <div className="studio-field">
              <span className="studio-field__label">Теги</span>
              <TagInput value={tags} onChange={setTags} placeholder="Тег и Enter" />
            </div>

            <div className="videdit__used">
              <div className="videdit__used-label">Используется в публикациях</div>
              {video.usedIn.length === 0 ? (
                <div className="videdit__used-empty">Не прикреплено ни к одной публикации</div>
              ) : (
                <ul className="videdit__used-list">
                  {video.usedIn.map((p) => (
                    <li key={p.id}>
                      <Link href={`/studio/posts/${p.id}`} className="videdit__used-link">
                        <FileText size={14} className="videdit__used-icon" />
                        <span className="videdit__used-title">{p.title}</span>
                        <ArrowUpRight size={14} className="videdit__used-arrow" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Удаление */}
            <div className="videdit__danger" style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--st-border, rgba(0,0,0,.1))' }}>
              {inUse ? (
                <div style={{ fontSize: 13, color: 'var(--brand-muted)' }}>
                  Удаление недоступно: видео используется в публикациях ({video.usedIn.length}). Сначала открепите его в этих публикациях.
                </div>
              ) : confirmDel ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13 }}>Удалить видео безвозвратно?</span>
                  <button className="studio-btn studio-btn--danger" onClick={doDelete} disabled={deleting}>
                    {deleting ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />} Удалить
                  </button>
                  <button className="studio-btn studio-btn--ghost" onClick={() => setConfirmDel(false)} disabled={deleting}>Отмена</button>
                </div>
              ) : (
                <button className="studio-btn studio-btn--ghost" onClick={() => setConfirmDel(true)} style={{ color: 'var(--st-danger, #c0392b)' }}>
                  <Trash2 size={16} /> Удалить видео
                </button>
              )}
            </div>
          </div>
        )}

        {tab === 'subtitles' && isSelf && (
          <SubtitlesSection videoId={video.id} playbackId={video.playbackId ?? null} initial={video.subtitles || []} />
        )}
        {tab === 'chapters' && isSelf && (
          <ChaptersSection videoId={video.id} initial={video.chapters || []} />
        )}
        {tab === 'analytics' && isSelf && (
          <AnalyticsSection videoId={video.id} />
        )}
        {tab === 'summary' && isSelf && (
          <SummarySection videoId={video.id} initial={video.summary ?? null} hasSubtitles={(video.subtitles || []).length > 0} />
        )}
      </div>

      {/* Нижняя панель — сохранение основных полей (актуально на табе «Обзор»). */}
      {tab === 'overview' && (
        <div className="vidpage__foot">
          {error && <div className="studio-login__error" style={{ flex: 1 }}>{error}</div>}
          {savedOk && !error && (
            <div style={{ flex: 1, fontSize: 13, color: 'var(--success, #22c55e)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Check size={15} /> Сохранено
            </div>
          )}
          <button className="studio-btn studio-btn--primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Сохранить
          </button>
        </div>
      )}
    </div>
  )
}
