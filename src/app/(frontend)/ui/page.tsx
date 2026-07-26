import React from 'react'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { UIShowcaseExtra } from '@/components/UIShowcaseExtra'

/**
 * Витрина-канон UI-kit (/ui) — единственный источник правды по примитивам.
 *
 * Каждый элемент показан во всех вариантах/состояниях, с меткой статуса
 * («в деле · N» / «новый») и счётчиком реальных использований по фан-сайту.
 * Ниже основной библиотеки — блок кандидатов на будущее. Новые элементы
 * добавляются только сюда (и в .c-* классы styles.css), не плодятся инлайном.
 *
 * brandVars даёт --brand-primary/-accent + шрифты (из тенанта).
 * bg/surface/text задаёт локальный переключатель темы внутри показа.
 */
export default async function UIPage() {
  const ctx = await getTenantFromHeaders()
  const settings = ctx?.settings as any

  return (
    <main style={{ ...brandVars(settings?.theme, settings?.typography) }}>
      <UIShowcaseExtra />
    </main>
  )
}
