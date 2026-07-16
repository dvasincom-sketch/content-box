import React from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * Заглушка композера. Полноценное создание поста (тело, обложка, категория,
 * уровень доступа, загрузка медиа) — Шаг 3.
 */
export default function NewPostPage() {
  return (
    <>
      <div className="studio-page-head">
        <div>
          <Link href="/studio/posts" className="studio-back">
            <ArrowLeft size={16} />
            К публикациям
          </Link>
          <h1 style={{ marginTop: 'var(--st-space-2)' }}>Новая публикация</h1>
        </div>
      </div>

      <div className="studio-card">
        <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>
          Композер появится на Шаге 3: заголовок, тело, обложка, категория и уровень доступа.
        </p>
      </div>
    </>
  )
}
