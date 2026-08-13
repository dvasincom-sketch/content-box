'use client'

import React, { useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ImagePlus, ImageOff, X, Loader2, Trash2, Newspaper, Sparkles, Video, Music, Plus, ExternalLink, RotateCcw } from 'lucide-react'
import { slugify } from '@/lib/slugify'
import { CategoryPicker, type CatItem } from './CategoryPicker'
import { CategoryMultiPicker } from '../../settings/CategoryMultiPicker'
import { TiptapEditor } from './TiptapEditor'
import { ProfileEditor, type ProfileData } from './ProfileEditor'
import { VideoAttachPicker, type VideoOption } from './VideoAttachPicker'
import { GalleryComposer, type GalleryItem } from './GalleryComposer'
import { VideoCreateModal, AudioUploadButton, type CreatedMedia } from './MediaCreate'
import { StudioSelect } from '../../_ui/StudioSelect'
import { TagInput } from '../../_ui/TagInput'
import { StudioDateField } from './StudioDateField'

type Category = CatItem
type GalleryFolder = { id: number | string; title: string; parentId: number | string | null }
type Tier = { id: number | string; name: string; weight: number; priceRub: number }
type MetaCat = { id: number | string; title: string; depth: number }

/** Плоский список категорий с глубиной (для дерева в форме добавления видео). */
function flattenCategories(cats: Category[]): MetaCat[] {
  const byParent = new Map<string, Category[]>()
  for (const c of cats) {
    const key = c.parentId == null ? 'root' : String(c.parentId)
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(c)
  }
  const out: MetaCat[] = []
  const walk = (key: string, depth: number) => {
    for (const c of byParent.get(key) || []) {
      out.push({ id: c.id, title: c.title, depth })
      walk(String(c.id), depth + 1)
    }
  }
  walk('root', 0)
  return out
}

/** «13 авг 2026, 14:30» — момент предыдущей версии для панели истории версий. */
function fmtWhen(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ', ')
  }
}

export type PostInitial = {
  id: number | string
  title: string
  body: string
  slug: string
  categoryId: string
  extraCategoryIds?: string[]
  minTierId: string
  coverId: number | null
  coverUrl: string | null
  isPublished: boolean
  isNews?: boolean
  isNew?: boolean
  /** До какого момента публикация висит в «Новинках» (проставляет сервер). */
  newUntil?: string | null
  template?: string
  profile?: ProfileData | null
  relatedVideoIds: (number | string)[]
  gallery: GalleryItem[]
  tags?: string[]
  eventDate?: string | null
  /** Момент прошлого сохранённого снимка (для панели «История версий»). null — снимка ещё нет. */
  prevVersionAt?: string | null
}

export function Composer({
  categories,
  tiers,
  videos = [],
  galleryFolders = [],
  canCreateMedia = true,
  initial,
}: {
  categories: Category[]
  tiers: Tier[]
  videos?: VideoOption[]
  galleryFolders?: GalleryFolder[]
  /** Право создавать медиа инлайн (capMedia). Прикрепление существующего — всегда. */
  canCreateMedia?: boolean
  initial?: PostInitial
}) {
  const router = useRouter()
  const isEdit = !!initial

  const [title, setTitle] = useState(initial?.title || '')
  const [body, setBody] = useState(initial?.body || '')
  const [template, setTemplate] = useState<string>(initial?.template || 'article')
  const [profile, setProfile] = useState<ProfileData | null>(initial?.profile ?? null)
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId || '')
  const [extraCategoryIds, setExtraCategoryIds] = useState<string[]>(initial?.extraCategoryIds ?? [])
  const [minTierId, setMinTierId] = useState<string>(initial?.minTierId || '')
  const [isNews, setIsNews] = useState<boolean>(initial?.isNews ?? false)
  const [isNew, setIsNew] = useState<boolean>(initial?.isNew ?? false)

  const [coverId, setCoverId] = useState<number | null>(initial?.coverId ?? null)
  const [coverUrl, setCoverUrl] = useState<string | null>(initial?.coverUrl ?? null)
  const [coverBroken, setCoverBroken] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Медиа-записи (видео + аудио — одна коллекция videos, аудио = provider 'audio').
  // Держим клиентский список, чтобы созданное инлайн сразу появлялось в пикерах.
  const [allMedia, setAllMedia] = useState<VideoOption[]>(videos)
  const videoCandidates = useMemo(() => allMedia.filter((v) => (v.provider ?? null) !== 'audio'), [allMedia])
  const audioCandidates = useMemo(() => allMedia.filter((v) => (v.provider ?? null) === 'audio'), [allMedia])
  const videoModalCats = useMemo(() => flattenCategories(categories), [categories])
  const catOptions = useMemo(() => videoModalCats.map((c) => ({ id: c.id, title: (c.depth ? '\u00A0\u00A0'.repeat(c.depth) : '') + c.title })), [videoModalCats])
  // Категория-афиша (posterLayout): для неё обложка вертикальная 2:3.
  const isPosterCategory = useMemo(() => {
    const c = categories.find((x) => String(x.id) === String(categoryId))
    return Boolean((c as { posterLayout?: boolean } | undefined)?.posterLayout)
  }, [categories, categoryId])
  // Категория-события: показываем «Дата события» только для неё.
  const isEventCategory = useMemo(() => {
    const c = categories.find((x) => String(x.id) === String(categoryId))
    return Boolean((c as { eventTemplate?: boolean } | undefined)?.eventTemplate)
  }, [categories, categoryId])

  // Разбиваем прикреплённые из initial по типу (видео / аудио) по provider.
  const initRelated = initial?.relatedVideoIds ?? []
  const [videoIds, setVideoIds] = useState<(number | string)[]>(
    initRelated.filter((id) => (videos.find((v) => String(v.id) === String(id))?.provider ?? null) !== 'audio'),
  )
  const [audioIds, setAudioIds] = useState<(number | string)[]>(
    initRelated.filter((id) => (videos.find((v) => String(v.id) === String(id))?.provider ?? null) === 'audio'),
  )
  const [videoModalOpen, setVideoModalOpen] = useState(false)

  function onVideoCreated(v: CreatedMedia) {
    // Новое видео из композера — это загрузка в своё хранилище (провайдер по
    // умолчанию 'self'), оно сразу уходит в обработку. Помечаем как processing,
    // чтобы в списке прикреплённых тут же был бейдж «обрабатывается» — автору не
    // нужно уходить в раздел «Видео», чтобы это увидеть.
    setAllMedia((prev) => [{ id: v.id, title: v.title, addedAt: null, provider: 'self', assetStatus: 'processing' }, ...prev])
    setVideoIds((prev) => (prev.some((x) => String(x) === String(v.id)) ? prev : [...prev, v.id]))
    setVideoModalOpen(false)
  }
  function onAudioCreated(v: CreatedMedia) {
    setAllMedia((prev) => [{ id: v.id, title: v.title, addedAt: null, provider: 'audio' }, ...prev])
    setAudioIds((prev) => (prev.some((x) => String(x) === String(v.id)) ? prev : [...prev, v.id]))
  }

  const [gallery, setGallery] = useState<GalleryItem[]>(initial?.gallery ?? [])
  const profileMedia = { gallery, setGallery, galleryFolders, videoCandidates, videoIds, setVideoIds, videoModalCats, canCreateMedia, openVideoModal: () => setVideoModalOpen(true) }
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [eventDate, setEventDate] = useState<string>(initial?.eventDate ? String(initial.eventDate).slice(0, 10) : '')

  const [saving, setSaving] = useState<false | 'draft' | 'publish' | 'save' | 'unpublish'>(false)
  const [deleting, setDeleting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // В edit slug фиксирован (может быть в ссылках); в create — превью из заголовка.
  const slugText = isEdit ? initial!.slug : slugify(title)

  async function handleCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    const ctrl = new AbortController()
    const to = setTimeout(() => ctrl.abort(), 30000)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/studio/api/upload-cover', {
        method: 'POST',
        body: fd,
        credentials: 'include',
        signal: ctrl.signal,
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Не удалось загрузить обложку')
      else {
        setCoverId(json.id)
        setCoverUrl(json.url)
        setCoverBroken(false)
      }
    } catch (e) {
      setError((e as { name?: string })?.name === 'AbortError' ? 'Хранилище временно недоступно, попробуйте позже.' : 'Ошибка загрузки обложки')
    } finally {
      clearTimeout(to)
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function removeCover() {
    setCoverId(null)
    setCoverUrl(null)
    setCoverBroken(false)
  }

  // publish: true → опубликовать/сохранить как опубл.; false → черновик/снять
  async function persist(kind: 'draft' | 'publish' | 'save' | 'unpublish') {
    setError(null)
    if (!title.trim()) {
      setError('Укажите заголовок')
      return
    }
    setSaving(kind)

    // publish-флаг для роутов
    let publish: boolean | undefined
    if (kind === 'publish') publish = true
    else if (kind === 'draft') publish = false
    else if (kind === 'unpublish') publish = false
    else if (kind === 'save') publish = undefined // сохранить, статус не менять

    const endpoint = isEdit ? '/studio/api/update-post' : '/studio/api/create-post'
    const payload: any = {
      title: title.trim(),
      body,
      // в edit шлём явные значения (null очищает); в create — undefined опускает
      categoryId: isEdit ? (categoryId || null) : (categoryId || undefined),
      // Дополнительные категории (мультивыбор). В edit всегда шлём массив
      // (пустой = очистить), в create — только если есть.
      extraCategoryIds: isEdit ? extraCategoryIds : (extraCategoryIds.length ? extraCategoryIds : undefined),
      minTierId: isEdit ? (minTierId || null) : (minTierId || undefined),
      coverId: isEdit ? (coverId ?? null) : (coverId || undefined),
      // видео + аудио — одно поле relatedVideos (аудио = provider 'audio').
      // Порядок: сначала видео, затем аудио. В edit всегда шлём массив
      // (пустой = открепить все); в create — только если есть.
      relatedVideoIds: isEdit
        ? [...videoIds, ...audioIds]
        : (videoIds.length || audioIds.length ? [...videoIds, ...audioIds] : undefined),
      // галерея: массив {imageId, caption} в текущем порядке.
      // в edit всегда шлём (пустой = очистить); в create — только если есть
      gallery: isEdit
        ? gallery.map((g) => ({ imageId: g.imageId, caption: g.caption }))
        : (gallery.length
            ? gallery.map((g) => ({ imageId: g.imageId, caption: g.caption }))
            : undefined),
      // признак «Новость»: в edit шлём всегда (чтобы снятие сохранялось),
      // в create — только если включён
      isNews: isEdit ? isNews : (isNews || undefined),
      // признак «Новинка»: то же правило. Сервер по нему проставит окно 14 дней.
      isNew: isEdit ? isNew : (isNew || undefined),
      // свободные теги (лейблы): в edit шлём всегда (пустой = очистить),
      // в create — только если есть
      tags: isEdit ? tags : (tags.length ? tags : undefined),
      eventDate: isEdit ? (eventDate || null) : (eventDate || undefined),
      template,
      profile: template === 'profile' ? (profile || {}) : (isEdit ? null : undefined),
    }
    if (isEdit) payload.id = initial!.id
    if (publish !== undefined) payload.publish = publish

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось сохранить')
        setSaving(false)
        return
      }
      router.push('/studio/posts')
      router.refresh()
    } catch {
      setError('Ошибка соединения')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!isEdit) return
    const ok = window.confirm(`Удалить публикацию «${title || 'без заголовка'}»? Это действие необратимо.`)
    if (!ok) return
    setError(null)
    setDeleting(true)
    try {
      const res = await fetch('/studio/api/delete-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: initial!.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось удалить')
        setDeleting(false)
        return
      }
      router.push('/studio/posts')
      router.refresh()
    } catch {
      setError('Ошибка соединения')
      setDeleting(false)
    }
  }

  async function handleRestore() {
    if (!isEdit) return
    const ok = window.confirm(
      'Восстановить предыдущую версию? Текущее содержимое будет заменено, но сохранится как «предыдущая версия» — восстановление можно отменить тем же способом.',
    )
    if (!ok) return
    setError(null)
    setRestoring(true)
    try {
      const res = await fetch('/studio/api/restore-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: initial!.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Не удалось восстановить')
        setRestoring(false)
        return
      }
      // Перезагружаем страницу — форма заново инициализируется из свежих данных.
      window.location.reload()
    } catch {
      setError('Ошибка соединения')
      setRestoring(false)
    }
  }

  const busy = saving !== false || deleting || restoring

  return (
    <div className="composer">
      <div className="composer__head">
        <Link href="/studio/posts" className="studio-back">
          <ArrowLeft size={16} />
          К публикациям
        </Link>
        <div className="composer__actions">
          <StudioSelect
            value={template}
            onChange={setTemplate}
            options={[{ value: 'article', label: 'Статья' }, { value: 'profile', label: 'Страница' }]}
            ariaLabel="Тип публикации"
            className="composer__type-sel"
          />
          {isEdit && initial!.slug && (
            <a href={`/publication/${initial!.slug}`} target="_blank" rel="noopener" className="studio-btn studio-btn--ghost" title="Открыть публикацию на сайте">
              <ExternalLink size={16} /> На сайте
            </a>
          )}
          {isEdit ? (
            <>
              <button
                className="studio-btn studio-btn--ghost composer__delete"
                onClick={handleDelete}
                disabled={busy}
                title="Удалить публикацию"
              >
                {deleting ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                Удалить
              </button>
              {initial!.isPublished ? (
                <>
                  <button
                    className="studio-btn studio-btn--ghost"
                    onClick={() => persist('unpublish')}
                    disabled={busy}
                  >
                    {saving === 'unpublish' ? <Loader2 size={16} className="spin" /> : null}
                    Снять с публикации
                  </button>
                  <button
                    className="studio-btn studio-btn--primary"
                    onClick={() => persist('save')}
                    disabled={busy}
                  >
                    {saving === 'save' ? <Loader2 size={16} className="spin" /> : null}
                    Сохранить
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="studio-btn studio-btn--ghost"
                    onClick={() => persist('save')}
                    disabled={busy}
                  >
                    {saving === 'save' ? <Loader2 size={16} className="spin" /> : null}
                    Сохранить черновик
                  </button>
                  <button
                    className="studio-btn studio-btn--primary"
                    onClick={() => persist('publish')}
                    disabled={busy}
                  >
                    {saving === 'publish' ? <Loader2 size={16} className="spin" /> : null}
                    Опубликовать
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button
                className="studio-btn studio-btn--ghost"
                onClick={() => persist('draft')}
                disabled={busy}
              >
                {saving === 'draft' ? <Loader2 size={16} className="spin" /> : null}
                Черновик
              </button>
              <button
                className="studio-btn studio-btn--primary"
                onClick={() => persist('publish')}
                disabled={busy}
              >
                {saving === 'publish' ? <Loader2 size={16} className="spin" /> : null}
                Опубликовать
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="studio-login__error composer__error">{error}</div>}

      <div className="composer__grid">
        <div className="composer__main">
          {template !== 'profile' && (
          <>
          <div className="composer__flags">
            <button
              type="button"
              className={`composer__flag${isNews ? ' is-on' : ''}`}
              onClick={() => setIsNews((v) => !v)}
              aria-pressed={isNews}
              title="Пометить как новость — попадёт в секцию «Новости» на главной"
            >
              <Newspaper size={14} />
              Новость
            </button>
            <button
              type="button"
              className={`composer__flag${isNew ? ' is-on' : ''}`}
              onClick={() => setIsNew((v) => !v)}
              aria-pressed={isNew}
              title="Пометить как новинку — 14 дней публикация висит в разделе «Новинки», потом только в своей категории"
            >
              <Sparkles size={14} />
              Новинка
            </button>
          </div>
          {isNew && (
            <div className="composer__hint" style={{ marginTop: 8 }}>
              {initial?.isNew && initial?.newUntil
                ? `В разделе «Новинки» до ${new Date(initial.newUntil).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'После сохранения — 14 дней в разделе «Новинки», затем только в своих категориях'}
            </div>
          )}
          </>
          )}
          <input
            className="composer__title"
            placeholder="Заголовок публикации"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {slugText && (
            <div className="composer__slug">
              /{slugText}
              {!isEdit && <span className="composer__slug-caret" aria-hidden />}
            </div>
          )}

          <div className={"composer__coverwrap" + (isPosterCategory ? " composer__coverwrap--poster" : "")}>
          {coverUrl && !coverBroken ? (
            <div className={"composer__cover" + (isPosterCategory ? " composer__cover--poster" : "")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt="Обложка" onError={() => setCoverBroken(true)} />
              <button className="composer__cover-remove" onClick={removeCover} title="Убрать">
                <X size={16} />
              </button>
            </div>
          ) : coverUrl && coverBroken ? (
            <div className="composer__cover-broken">
              <ImageOff size={22} className="composer__cover-broken-ic" />
              <div className="composer__cover-broken-txt">
                <div className="composer__cover-broken-title">Обложка не загрузилась</div>
                <div className="composer__cover-broken-sub">Файл повреждён или недоступен. Удалите её или загрузите заново.</div>
              </div>
              <button type="button" className="studio-btn studio-btn--ghost" onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 size={16} className="spin" /> : <ImagePlus size={16} />} Заменить
              </button>
              <button type="button" className="studio-btn studio-btn--danger" onClick={removeCover}>
                <X size={16} /> Удалить
              </button>
            </div>
          ) : (
            <button
              className="composer__cover-add"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 size={18} className="spin" /> : <ImagePlus size={18} />}
              {uploading ? 'Загрузка…' : 'Прикрепить обложку'}
            </button>
          )}
          {isPosterCategory && (
            <div className="composer__cover-hint">
              Основная категория — «Афиша»: обложка показывается вертикально (2:3). Чтобы сделать обычную горизонтальную — выберите другую категорию или отключите «Афишу» у этой категории в настройках.
            </div>
          )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={handleCover}
            style={{ display: 'none' }}
          />

          {template === 'profile' ? (
            <ProfileEditor value={profile} onChange={setProfile} cats={catOptions} media={profileMedia} />
          ) : (
            <TiptapEditor
              initialHtml={initial?.body || ''}
              onChange={setBody}
              placeholder="Текст публикации. Выделите текст и примените форматирование."
            />
          )}

          {template !== 'profile' && (
          <div className="composer__media">
            <div className="composer__field-label composer__gallery-label">Медиа</div>

            <div className="composer__media-section">
              <div className="composer__media-head">Галерея</div>
              <GalleryComposer
                value={gallery}
                onChange={setGallery}
                folders={galleryFolders}
              />
              <div className="composer__hint">
                Изображения показываются сеткой на странице публикации. Доступ — по уровню самой публикации. Порядок — перетаскиванием.
              </div>
            </div>

            <div className="composer__media-section">
              <div className="composer__media-head">Видео</div>
              <VideoAttachPicker
                videos={videoCandidates}
                value={videoIds}
                onChange={setVideoIds}
                categoryTree={videoModalCats}
                searchPlaceholder="Поиск видео по названию…"
                emptyLabel="Нет загруженных видео"
                icon={Video}
                leadingButton={canCreateMedia ? (
                  <button type="button" className="gcomp__add" onClick={() => setVideoModalOpen(true)}>
                    <Plus size={16} /> Добавить видео
                  </button>
                ) : undefined}
              />
              <div className="composer__hint">
                Видео появятся на странице публикации в указанном порядке — до описания.
              </div>
              {videoIds.some((id) => {
                const v = videoCandidates.find((c) => String(c.id) === String(id))
                const t = (v?.title || '').trim()
                return !t || /^Видео · /.test(t)
              }) && (
                <div className="composer__hint" style={{ color: 'var(--st-warning)' }}>
                  У некоторых видео нет своего названия — им присвоится заголовок
                  этой публикации при сохранении. Переименовать можно в разделе «Видео».
                </div>
              )}
            </div>

            <div className="composer__media-section">
              <div className="composer__media-head">Аудио</div>
              <VideoAttachPicker
                videos={audioCandidates}
                value={audioIds}
                onChange={setAudioIds}
                categoryTree={videoModalCats}
                searchPlaceholder="Поиск аудио по названию…"
                emptyLabel="Нет загруженных аудио"
                icon={Music}
                leadingButton={canCreateMedia ? (
                  <AudioUploadButton onCreated={onAudioCreated} />
                ) : undefined}
              />
              <div className="composer__hint">
                Аудио (MP3) показывается плеером на странице публикации.
              </div>
            </div>
          </div>
          )}
        </div>

        <aside className="composer__side">
          <div className="composer__field">
            <div className="composer__field-label">Уровень доступа</div>
            <StudioSelect
              value={minTierId}
              onChange={setMinTierId}
              options={[
                { value: '', label: 'Бесплатно — для всех' },
                ...tiers.map((t) => ({ value: String(t.id), label: `${t.name} · ${t.priceRub}₽` })),
              ]}
              ariaLabel="Уровень доступа"
            />
            <div className="composer__hint">
              Публикация будет доступна подписчикам этого уровня и выше.
            </div>
          </div>

          <div className="composer__field">
            <div className="composer__field-label">Основная категория</div>
            <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
            {template === 'profile' && categoryId && (
              <div className="composer__hint" style={{ color: '#2f6bed' }}>
                Эта страница станет главной для выбранного раздела — тип раздела автоматически сменится на «Страница» при сохранении.
              </div>
            )}
          </div>

          {template !== 'profile' && isEventCategory && (
          <div className="composer__field">
            <div className="composer__field-label">Дата события</div>
            <StudioDateField value={eventDate} onChange={setEventDate} />
            <div className="composer__hint">Раздел-события: по этой дате сортируется список и рисуется оранжевая плашка. Можно оставить пустым.</div>
          </div>
          )}

          {template !== 'profile' && (
          <div className="composer__field">
            <div className="composer__field-label">Дополнительные категории</div>
            <CategoryMultiPicker
              categories={categories}
              value={extraCategoryIds}
              onChange={setExtraCategoryIds}
            />
            <div className="composer__hint">
              Публикация появится и в этих категориях. Основная — та, что выбрана выше.
            </div>
          </div>
          )}

          <div className="composer__field">
            <div className="composer__field-label">Теги</div>
            <TagInput value={tags} onChange={setTags} placeholder="Тег и Enter" />
            <div className="composer__hint">
              Связывают материалы из разных категорий. Клик по тегу на сайте ведёт на страницу со всеми материалами тега.
            </div>
          </div>

          {isEdit && (
          <div className="composer__field composer__version">
            <div className="composer__field-label">История версий</div>
            {initial?.prevVersionAt ? (
              <>
                <div className="composer__hint" style={{ marginTop: 0 }}>
                  Предыдущая версия от {fmtWhen(initial.prevVersionAt)}. Если это сохранение оказалось ошибкой — верните её.
                </div>
                <button
                  type="button"
                  className="composer__version-restore"
                  onClick={handleRestore}
                  disabled={busy}
                >
                  {restoring ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />}
                  {restoring ? 'Восстановление…' : 'Восстановить предыдущую'}
                </button>
                <div className="composer__hint" style={{ marginTop: 8 }}>
                  Хранится только одна предыдущая версия. Восстановление обратимо: текущее содержимое станет предыдущей версией.
                </div>
              </>
            ) : (
              <div className="composer__hint" style={{ marginTop: 0 }}>
                Пока нет предыдущих версий. Она создаётся автоматически при каждом сохранении — сюда попадёт состояние «как было до правки».
              </div>
            )}
          </div>
          )}
        </aside>
      </div>

      {videoModalOpen && (
        <VideoCreateModal
          tiers={tiers}
          categories={videoModalCats}
          onCreated={onVideoCreated}
          onClose={() => setVideoModalOpen(false)}
        />
      )}
    </div>
  )
}
