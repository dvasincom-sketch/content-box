'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * SessionGuard — следит за живостью сессии автора в студии.
 *
 * Серверный guard в (app)/layout ловит истёкшую сессию только при
 * перезагрузке/навигации. Но если токен протух в фоне (например, ноутбук был
 * в спящем режиме), клиентские запросы просто получают 401 без единого
 * обработчика — раньше это выглядело как молчаливый провал (не грузилась
 * обложка и т.п.).
 *
 * Этот компонент пингует /studio/api/session при возврате фокуса на вкладку
 * (visibilitychange + focus — как раз случай «экран уснул») и раз в
 * CHECK_INTERVAL. На 401 показывает полноэкранный оверлей «Сессия истекла» с
 * кнопкой перелогина. Сетевые сбои сессией не считаются — просто повторим позже.
 */
const CHECK_INTERVAL = 4 * 60 * 1000 // 4 минуты

export function SessionGuard() {
  const [expired, setExpired] = useState(false)
  const expiredRef = useRef(false)
  const checking = useRef(false)

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    let cancelled = false

    const markExpired = () => {
      if (cancelled) return
      expiredRef.current = true
      setExpired(true)
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }

    const check = async () => {
      if (cancelled || expiredRef.current || checking.current) return
      checking.current = true
      try {
        const res = await fetch('/studio/api/session', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        })
        if (res.status === 401) markExpired()
      } catch {
        // сеть недоступна — не считаем сессию истёкшей, повторим позже
      } finally {
        checking.current = false
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    const onFocus = () => void check()

    timer = setInterval(() => void check(), CHECK_INTERVAL)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  if (!expired) return null

  return (
    <div
      className="session-expired"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
    >
      <div className="session-expired__card">
        <h2 id="session-expired-title" className="session-expired__title">
          Сессия истекла
        </h2>
        <p className="session-expired__text">
          Время сессии вышло — возможно, устройство было в спящем режиме. Войдите
          снова, чтобы продолжить работу. Несохранённые изменения на этой странице
          лучше скопировать перед входом.
        </p>
        <a href="/studio/login" className="session-expired__btn">
          Войти снова
        </a>
      </div>
    </div>
  )
}
