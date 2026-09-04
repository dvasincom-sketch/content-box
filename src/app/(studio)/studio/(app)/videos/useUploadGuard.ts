'use client'

import { useEffect } from 'react'

/**
 * Предупреждение об уходе со страницы во время загрузки видео.
 *
 * Пока `active === true`:
 *  1. Закрытие/обновление вкладки и переход на внешний адрес → нативный диалог
 *     браузера beforeunload («изменения могут не сохраниться»). Текст в
 *     современных браузерах не кастомизируется — показывается стандартный.
 *  2. Клик по внутренней ссылке (меню студии рендерит <a href>, клиентская
 *     навигация Next — beforeunload на неё НЕ срабатывает) перехватывается в
 *     фазе capture и требует подтверждения.
 *  3. Кнопка «назад» браузера (popstate в SPA — тоже без beforeunload) —
 *     подтверждение, иначе остаёмся на странице.
 *
 * Всё снимается, как только загрузка закончилась/прервана (active → false)
 * или компонент размонтирован — обычная навигация снова без помех.
 */
const DEFAULT_MESSAGE =
  'Идёт загрузка видео. Если покинуть страницу, загрузка прервётся и заполненные данные не сохранятся. Дождитесь окончания загрузки.'

export function useUploadGuard(active: boolean, message: string = DEFAULT_MESSAGE): void {
  useEffect(() => {
    if (!active) return

    // 1) Закрытие/обновление вкладки, внешняя навигация.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Legacy-совместимость: некоторым браузерам нужно returnValue.
      e.returnValue = message
      return message
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    // 2) Перехват кликов по ссылкам (внутренняя SPA-навигация Next).
    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented) return
      // Пропускаем модификаторы/среднюю кнопку (открытие в новой вкладке и т.п.).
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const a = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute('href') || ''
      // Якоря на странице, новые вкладки и скачивания не прерывают загрузку.
      if (!href || href.startsWith('#') || a.target === '_blank' || a.hasAttribute('download')) return
      if (!window.confirm(message)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener('click', onClickCapture, true)

    // 3) Кнопка «назад». Ставим «якорь» в истории, чтобы popstate был
    //    перехватываемым, и при отказе возвращаем пользователя вперёд.
    const onPopState = () => {
      if (!window.confirm(message)) {
        history.pushState(null, '', window.location.href)
      }
    }
    history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClickCapture, true)
      window.removeEventListener('popstate', onPopState)
    }
  }, [active, message])
}
