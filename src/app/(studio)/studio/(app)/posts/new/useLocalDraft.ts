'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Локальный авточерновик редактора публикации (Уровень 1 автосохранения).
 *
 * Задача — не потерять часы работы, если вкладку закрыли/обновили/браузер упал
 * ДО ручного сохранения. Пишем полный снимок состояния редактора в localStorage
 * раз в ~15 сек (только если что-то изменилось) и дополнительно при скрытии/
 * закрытии вкладки. Это безопасно: ничего не уходит на сервер и ничего не
 * публикуется — чистая клиентская страховка на этом устройстве/в этом браузере.
 *
 * localStorage может быть недоступен (приватный режим, заблокированные куки) —
 * все обращения обёрнуты в try/catch, при ошибке просто ничего не сохраняем.
 */

const PREFIX = 'cb-postdraft:'

/** Ключ черновика: по id публикации (правка) либо 'new' (создание). */
export function draftKeyFor(id?: string | number | null): string {
  return PREFIX + (id != null && id !== '' ? String(id) : 'new')
}

export type LocalDraft<T = unknown> = { v: 1; savedAt: string; data: T }

export function readLocalDraft<T = unknown>(key: string): LocalDraft<T> | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (p && p.v === 1 && typeof p.savedAt === 'string' && p.data) return p as LocalDraft<T>
    return null
  } catch {
    return null
  }
}

export function clearLocalDraft(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* приватный режим — нечего чистить */
  }
}

/**
 * Периодически (intervalMs) сохраняет `data` в localStorage под `key`, пока
 * `enabled`. Возвращает время последнего локального сохранения (для индикатора).
 * Запись происходит только при реальном изменении данных (сравнение по JSON),
 * чтобы не гонять localStorage вхолостую.
 */
export function useLocalDraftAutosave<T>({
  key,
  data,
  enabled = true,
  intervalMs = 15000,
}: {
  key: string
  data: T
  enabled?: boolean
  intervalMs?: number
}): { savedAt: string | null } {
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data
  const lastJsonRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    const write = () => {
      try {
        const json = JSON.stringify(dataRef.current)
        if (json === lastJsonRef.current) return // ничего не поменялось
        const now = new Date().toISOString()
        localStorage.setItem(key, JSON.stringify({ v: 1, savedAt: now, data: dataRef.current }))
        lastJsonRef.current = json
        setSavedAt(now)
      } catch {
        /* нет доступа к localStorage — тихо пропускаем */
      }
    }
    const timer = setInterval(write, intervalMs)
    // Подстраховка на последние секунды перед уходом со страницы.
    const onVisibility = () => { if (document.visibilityState === 'hidden') write() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', write)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', write)
    }
  }, [key, enabled, intervalMs])

  return { savedAt }
}
