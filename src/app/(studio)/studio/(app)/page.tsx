import React from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Дашборд студии. На Шаге 1 — минимум: приветствие + быстрое действие.
 * Лента последних публикаций появится на Шаге 2.
 */
export default async function StudioDashboard() {
  const author = await getCurrentAuthor() // guard в layout гарантирует, что он есть

  return (
    <>
      <div className="studio-page-head">
        <div>
          <h1>Дашборд</h1>
          <div className="studio-page-head__sub">
            Вы вошли как {author?.user.email}
          </div>
        </div>
        <Link href="/studio/posts/new" className="studio-btn studio-btn--primary">
          <Plus size={18} />
          Новая публикация
        </Link>
      </div>

      <div className="studio-card">
        <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>
          Студия готова. Лента публикаций и композер появятся на следующих шагах.
        </p>
      </div>
    </>
  )
}
