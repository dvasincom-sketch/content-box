'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Upload, Pencil, Play, Lock, Unlock, Headphones } from 'lucide-react'
import { StudioSelect } from '../_ui/StudioSelect'
import { AudioEditModal } from './AudioEditModal'
import type { EditableVideo } from '../videos/VideoSections'

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
 * Прямая загрузка файла в S3 по presigned-URL с прогрессом (XHR — fetch не даёт
 * upload-прогресса). Content-Type обязан совпасть с тем, под который выдана подпись.
 */
function putWithProgress(url: string, file: File, contentType: string, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('S3 ' + xhr.status)))
    xhr.onerror = () => reject(new Error('network'))
    xhr.send(file)
  })
}

/**
 * Раздел «Аудио» студии: загрузка MP3 напрямую в S3 (presigned: presign →
 * PUT в бакет → finalize) и список аудио-записей. Файл через приложение не идёт
 * и в памяти сервера не буферится. Редактирование/удаление — окном VideoEditModal.
 */
export function AudioManager({
  initialAudios,
  tiers,
  categories,
  canCreate = true,
}: {
  initialAudios: AudioItem[]
  tiers: Tier[]
  categories: Cat[]
  canCreate?: boolean
}) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [minTierId, setMinTierId] = useState('')
  const [isPreview, setIsPreview] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
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
    setProgress(0)
    try {
      const ct = file.type || 'audio/mpeg'
      // 1) presign — подписанный URL на прямую заливку
      const pres = await fetch('/studio/api/videos/audio-presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ filename: file.name, contentType: ct, size: file.size }),
      })
      const pj = await pres.json().catch(() => ({}))
      if (!pres.ok) {
        setError(pj.error || 'Не удалось начать загрузку')
        setBusy(false)
        return
      }
      // 2) прямая загрузка в S3 (браузер → бакет), с прогрессом
      await putWithProgress(pj.uploadUrl, file, pj.contentType || ct, setProgress)
      // 3) finalize — создать запись по уже загруженному объекту
      const fin = await fetch('/studio/api/videos/audio-finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          key: pj.key,
          title: title.trim() || file.name,
          minTierId: minTierId || null,
          isPreview,
          categoryId: categoryId || null,
        }),
      })
      const fj = await fin.json().catch(() => ({}))
      if (!fin.ok) {
        setError(fj.error || 'Не удалось сохранить аудио')
        setBusy(false)
        return
      }
      setFile(null)
      setTitle('')
      setMinTierId('')
      setIsPreview(false)
      setCategoryId('')
      setProgress(0)
      router.refresh()
    } catch {
      setError('Не удалось загрузить в хранилище. Если это первый запуск presigned — проверьте, что на бакете настроен CORS (PUT с домена студии).')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="studio-page">
      <div className="studio-page-head">
        <h1>Аудио</h1>
      </div>

      {canCreate && (
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

        {busy && (
          <div style={{ height: 6, borderRadius: 999, background: 'var(--st-border, rgba(255,255,255,0.12))', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--st-accent, #7c3aed)', transition: 'width .2s ease' }} />
          </div>
        )}

        {error && <div className="studio-login__error">{error}</div>}
        <div style={{ fontSize: 12, color: 'var(--st-text-muted)' }}>
          Файл грузится напрямую в хранилище, минуя сервер — можно большие MP3 (до 200 МБ). Для архива из сотен файлов будет отдельный массовый импорт.
        </div>
        <div>
          <button className="studio-btn studio-btn--primary" onClick={upload} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}{' '}
            {busy ? (progress < 100 ? `Загрузка… ${progress}%` : 'Сохранение…') : 'Загрузить'}
          </button>
        </div>
      </div>

      )}

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
                  {a.addedAt && <span>{new Date(a.addedAt).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' })}</span>}
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
        <AudioEditModal
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
