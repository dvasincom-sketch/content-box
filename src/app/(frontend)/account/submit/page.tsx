import React from 'react'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { SubmitForm } from './SubmitForm'

/** Отправка публикации участником (внутри кабинета). */
export const dynamic = 'force-dynamic'

export default async function SubmitPage() {
  const sub = await getCurrentSubscriber()
  if (!sub) return null
  // Категорию у формы убрали — у площадки одна общая лента, раздел назначает
  // редактор при одобрении. Список категорий тянуть больше не нужно.
  return <SubmitForm />
}
