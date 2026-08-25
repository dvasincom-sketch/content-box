'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { TiptapEditor } from '@/app/(studio)/studio/(app)/posts/new/TiptapEditor'
import { createSubmission } from './actions'

/**
 * Форма отправки публикации участником. Тот же редактор, что в Студии
 * (Tiptap) → HTML → сервер конвертирует в Lexical. Картинки выключены: их
 * загрузка идёт в роут студии и требует сессии автора. Trusted (L4) публикует
 * сразу; остальные — на модерацию.
 *
 * Выбор категории убран: у площадки одна общая лента, раздел материалу
 * назначает редактор при одобрении.
 */
export function SubmitForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit() {
    setError(null)
    if (!title.trim()) {
      setError('Укажите заголовок.')
      return
    }
    setBusy(true)
    try {
      const res = await createSubmission({ title, bodyHtml, categoryId: null })
      if (!res.ok) {
        setError(res.error)
      } else if (res.status === 'published' && res.slug) {
        router.push(`/publication/${res.slug}`)
      } else {
        setPending(true)
      }
    } catch {
      setError('Ошибка соединения.')
    } finally {
      setBusy(false)
    }
  }

  if (pending) {
    return (
      <div className="c-card" style={{ padding: 28 }}>
        <h1 style={{ fontSize: 24, color: 'var(--brand-text)', marginBottom: 8 }}>Отправлено на модерацию</h1>
        <p style={{ color: 'var(--brand-muted)' }}>
          Публикация появится после проверки редактором. Спасибо за вклад в сообщество!
        </p>
      </div>
    )
  }

  return (
    <>
      <h1 style={{ fontSize: 28, color: 'var(--brand-text)', marginBottom: 6 }}>Новая публикация</h1>
      <p style={{ color: 'var(--brand-muted)', marginBottom: 20 }}>
        Материал участника. После проверки редактором он выйдет с вашей подписью.
      </p>

      <div className="c-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input
          className="c-input"
          placeholder="Заголовок"
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TiptapEditor onChange={setBodyHtml} placeholder="Текст публикации…" allowImages={false} />
        {error && <div style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="c-btn c-btn--primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : null} Опубликовать
          </button>
        </div>
      </div>
    </>
  )
}
