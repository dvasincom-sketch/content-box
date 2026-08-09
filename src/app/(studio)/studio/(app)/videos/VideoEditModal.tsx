'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X, Loader2, Check, FileText, ArrowUpRight, Trash2, Link as LinkIcon } from 'lucide-react'
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
