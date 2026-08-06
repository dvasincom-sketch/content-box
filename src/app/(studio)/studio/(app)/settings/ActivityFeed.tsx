'use client'

import React, { useEffect, useState } from 'react'
import { Loader2, LogIn, FilePlus2, PencilLine, Trash2, Activity as ActivityIcon, UserPlus, CreditCard } from 'lucide-react'

type Item = { id: number | string; action: string; entity: string; title: string; at: string; user: string }

const ENTITY: Record<string, string> = { publication: 'публикацию', video: 'видео', book: 'книгу', download: 'файл', homepage: 'главную страницу', 'оформление': 'оформление', 'тариф': 'тариф', 'доступ': 'доступ', 'участника': 'участника', studio: '' }
const VERB: Record<string, string> = { login: 'вошёл в студию', create: 'создал', update: 'изменил', delete: 'удалил', invite: 'пригласил' }

function ActionIcon({ action }: { action: string }) {
  const p = { size: 15, style: { flexShrink: 0, color: 'var(--st-text-muted)' } }
  if (action === 'login') return <LogIn {...p} />
  if (action === 'invite') return <UserPlus {...p} />
  if (action === 'create') return <FilePlus2 {...p} />
  if (action === 'delete') return <Trash2 {...p} />
  return <PencilLine {...p} />
}

function rel(at: string): string {
  const t = new Date(at).getTime()
  if (!t) return ''
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 60) return 'только что'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} дн назад`
  return new Date(at).toLocaleDateString('ru-RU')
}

function phrase(it: Item): string {
  if (it.action === 'login') return VERB.login
  const verb = VERB[it.action] || it.action
  const ent = ENTITY[it.entity] ?? it.entity
  const title = it.title ? ` «${it.title}»` : ''
  return `${verb} ${ent}${title}`.replace(/\s+/g, ' ').trim()
}

/**
 * Лента активности студии (в «Доступе»): кто что делал и когда. Грузится с
 * /studio/api/settings/activity. Пустая — подсказка. Ошибка — тихо скрывается.
 */
export function ActivityFeed() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stop = false
    fetch('/studio/api/settings/activity', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (stop) return
        if (j?.error) setError(j.error)
        else setItems(Array.isArray(j.items) ? j.items : [])
      })
      .catch(() => !stop && setError('Не удалось загрузить активность'))
    return () => {
      stop = true
    }
  }, [])

  return (
    <div className="settings__block" style={{ marginTop: 8 }}>
      <div className="settings__block-head">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ActivityIcon size={18} /> Активность</h2>
        <p>Последние действия: вход, контент, оформление, тарифы, доступ и новые платные подписки.</p>
      </div>

      {items === null && !error ? (
        <div className="menubld__loading"><Loader2 size={18} className="spin" /> Загрузка…</div>
      ) : error ? (
        <div className="settings__hint">{error}</div>
      ) : items && items.length === 0 ? (
        <div className="settings__hint">Пока нет записей — они появятся, как только участники начнут работать.</div>
      ) : (
        <div className="actlog">
          {items!.map((it) => (
            <div key={it.id} className="actlog__row">
              {it.entity === 'subscription' ? <CreditCard size={15} style={{ flexShrink: 0, color: 'var(--st-text-muted)' }} /> : <ActionIcon action={it.action} />}
              <div className="actlog__body">
                <span className="actlog__text">
                  {it.entity === 'subscription' ? (
                    <>Новая подписка: <b>{it.title}</b></>
                  ) : (
                    <><b>{it.user}</b> {phrase(it)}</>
                  )}
                </span>
                <span className="actlog__time">{rel(it.at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
