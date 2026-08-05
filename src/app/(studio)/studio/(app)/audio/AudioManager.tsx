'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Upload, Pencil, Play, Lock, Unlock, Headphones } from 'lucide-react'
import { StudioSelect } from '../_ui/StudioSelect'
import { VideoEditModal, type EditableVideo } from '../videos/VideoEditModal'

type Tier = { id: number | string; name: string }
type Cat = { id: number | string; title: string; parentId: number | null }
type AudioItem = {
  id: number | string
  title: string
  slug: string | null
  minTierName: string | null
  minTierId: string
  isPreview: boolean
  addedAt: string | null
  season: number | null
  episode: number | null
  categoryId: string
  tags: string[]
  usedIn: { id: number | string; title: string }[]
}

/** Категории в порядке дерева + depth (StudioSelect делает отступ по depth). */
function categoryOptions(cats: Cat[]): { value: string; label: string; depth: number }[] {
  const present = new Set(cats.map((c) => Number(c.id)))
  const byParent = new Map<number | null, Cat[]>()
  for (const c of cats) {
    const pid = c.parentId != null && present.has(c.parentId) ? c.parentId : null
    if (!byParent.has(pid)) byParent.set(pid, [])
    byParent.get(pid)!.push(c)
  }
  for (const list of byParent.values()) list.sort((a, b) => String(a.title).localeCompare(String(b.title), 'ru'))
  const out: { value: string; label: string; depth: number }[] = []
  const walk = (parent: number | null, depth: number) => {
    for (const c of byParent.get(parent) ?? []) {
      out.push({ value: String(c.id), label: c.title, depth })
      walk(Number(c.id), depth + 1)
    }
  }
  walk(null, 0)
  return out
}

/**
 * Раздел «Аудио» студии: загрузка MP3 (в S3 через роут audio-upload) и список
 * аудио-записей. Редактирование/удаление — тем же окном, что у видео
 * (VideoEditModal): у аудио правятся название, уровень, категория, теги.
 */
export function AudioManager({
  initialAudios,
  tiers,
  categories,
}: {
  initialAudios: AudioItem[]
  tiers: Tier[]
  categories: Cat[]
}) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [minTierId, setMinTierId] = useState('')
  const [isPreview, setIsPreview] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditableVideo | null>(null)
  const catOptions = useMemo(() => categoryOptions(categories), [categories])

  async function upload() {
    setError(null)
    if (!file) {
      setError('Выберите MP3-файл')
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', title.trim() || file.name)
      if (minTierId) fd.append('minTierId', minTierId)
      if (isPreview) fd.append('isPreview', '1')
      if (categoryId) fd.append('categoryId', categoryId)
      const res = await fetch('/studio/api/videos/audio-upload', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Не удалось загрузить аудио')
        setBusy(false)
        return
      }
      setFile(null)
      setTitle('')
      setMinTierId('')
      setIsPreview(false)
      setCategoryId('')
      router.refresh()
    } catch {
      setError('Ошибка соединения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="studio-page">
      <div className="studio-page-head">
        <h1>Аудио</h1>
      </div>

      {/* Загрузка */}
      <div className="studio-card" style={{ padding: 20, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontWeight: 700 }}>Загрузить аудио (MP3)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label className="studio-btn studio-btn--ghost" style={{ cursor: 'pointer' }}>
            <Upload size={16} /> Выбрать MP3
            <input
              type="file"
              accept="audio/*,.mp3"
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <span
            style={{
              fontSize: 13,
              color: file ? 'var(--st-text)' : 'var(--st-text-muted)',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {file ? file.name : 'Файл не выбран'}
          </span>
        </div>
        <input
          className="studio-input"
          placeholder="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 200, flex: 1 }}>
            <StudioSelect
              value={minTierId}
              onChange={setMinTierId}
              options={[
                { value: '', label: 'Все / бесплатно' },
                ...tiers.map((t) => ({ value: String(t.id), label: `${t.name} и выше` })),
              ]}
              ariaLabel="Уровень доступа"
            />
          </div>
          <div style={{ minWidth: 200, flex: 1 }}>
            <StudioSelect
              value={categoryId}
              onChange={setCategoryId}
              options={[{ value: '', label: '— без категории —' }, ...catOptions]}
              ariaLabel="Категория"
            />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={isPreview} onChange={(e) => setIsPreview(e.target.checked)} />
          Бесплатное превью (открыто всем, перебивает уровень)
        </label>
        {error && <div className="studio-login__error">{error}</div>}
        <div style={{ fontSize: 12, color: 'var(--st-text-muted)' }}>
          Для архива из сотен файлов будет отдельный массовый импорт — здесь удобно добавлять по одному.
        </div>
        <div>
          <button className="studio-btn studio-btn--primary" onClick={upload} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} Загрузить
          </button>
        </div>
      </div>

      {/* Список */}
      {initialAudios.length === 0 ? (
        <div className="studio-empty">
          <div className="studio-empty__icon"><Headphones size={28} /></div>
          <div className="studio-empty__title">Аудио пока нет</div>
          <div className="studio-empty__text">Загрузите первый MP3 выше.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {initialAudios.map((a) => (
            <div
              key={a.id}
              className="studio-card"
              style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
            >
              <Headphones size={18} style={{ flex: 'none', color: 'var(--st-text-muted)' }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: 'var(--st-text-muted)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {a.isPreview ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Unlock size={12} /> Бесплатно</span>
                  ) : a.minTierName ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Lock size={12} /> {a.minTierName}</span>
                  ) : (
                    <span>Бесплатно</span>
                  )}
                  {a.addedAt && <span>{new Date(a.addedAt).toLocaleDateString('ru-RU')}</span>}
                </div>
              </div>
              {a.slug && (
                <Link href={`/video/${a.slug}`} target="_blank" className="studio-btn studio-btn--ghost">
                  <Play size={14} /> Слушать
                </Link>
              )}
              <button
                className="studio-btn studio-btn--ghost"
                onClick={() =>
                  setEditing({
                    id: a.id,
                    title: a.title,
                    minTierId: a.minTierId,
                    season: a.season,
                    episode: a.episode,
                    categoryId: a.categoryId,
                    tags: a.tags,
                    usedIn: a.usedIn,
                    provider: 'audio',
                    embedProvider: null,
                    embedSrc: null,
                  })
                }
              >
                <Pencil size={14} /> Изменить
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <VideoEditModal
          video={editing}
          tiers={tiers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
