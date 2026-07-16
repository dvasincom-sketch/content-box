import React from 'react'
import { redirect } from 'next/navigation'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Layout для экрана входа. Если автор уже залогинен — на дашборд, чтобы не
 * показывать форму входа поверх активной сессии.
 */
export default async function StudioAuthLayout({ children }: { children: React.ReactNode }) {
  const author = await getCurrentAuthor()
  if (author) {
    redirect('/studio')
  }
  return <>{children}</>
}
