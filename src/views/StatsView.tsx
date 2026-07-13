import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import React from 'react'

/**
 * Статистика — заглушка (root-view /admin/stats).
 *
 * Реальная аналитика (просмотры, выручка, отток) появится после запуска
 * подписок и накопления данных о транзакциях и просмотрах. Пока — плейсхолдер
 * в группе «Управление», чтобы место в навигации было зарезервировано.
 */
export default async function StatsView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, permissions, locale, visibleEntities } = initPageResult
  const { user, payload } = req

  if (!user) {
    return (
      <Gutter>
        <p>Требуется вход в систему.</p>
      </Gutter>
    )
  }

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user || undefined}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <h1 style={{ marginBottom: 8 }}>Статистика</h1>
        <p style={{ opacity: 0.7, maxWidth: 640 }}>
          Раздел аналитики появится после запуска подписок. Здесь будут метрики
          по подписчикам, выручке, просмотрам и оттоку — в стиле Patreon / Boosty.
          Данные начнут накапливаться с первой оплаты и первого просмотра.
        </p>
      </Gutter>
    </DefaultTemplate>
  )
}
