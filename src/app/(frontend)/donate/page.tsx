import React from 'react'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { DonateView, type DnGoal, type DnSupporter } from './DonateView'
import '../styles.css'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getTenantFromHeaders()
  if (!ctx) return {}
  const { tenant, settings } = ctx
  return buildMetadata({
    defaults: settings?.seoDefaults,
    fallbackTitle: 'Поддержать проект',
    brandName: tenant.name,
  })
}

// Демо-данные (в ₽), чтобы страница была «живой» до появления реальных сборов.
const DEMO_GOALS: DnGoal[] = [
  { id: 'd1', title: 'На восстановление нервной системы от блокировок интернета', description: 'VPN, кофе и валерьянка для команды, чтобы выпуски выходили несмотря ни на что.', targetRub: 115000, raisedRub: 35100 },
  { id: 'd2', title: 'Виниловый проигрыватель Rega Planar 3. ARIRANG сам себя не послушает', description: 'Собираем на нормальный звук для стримов и разборов треков.', targetRub: 244000, raisedRub: 43500 },
]
const DEMO_SUPPORTERS: DnSupporter[] = [
  { id: 's1', name: 'Алина К.', amountRub: 3000, message: 'Спасибо за озвучку, вы лучшие! Жду каждый выпуск 💜', dateLabel: '5 авг', isAnonymous: false, goalTitle: 'Виниловый проигрыватель Rega Planar 3' },
  { id: 's2', name: 'Аноним', amountRub: 5000, message: '', dateLabel: '5 авг', isAnonymous: true },
  { id: 's3', name: 'Дмитрий В.', amountRub: 1000, message: 'ARIRANG топ. Держитесь, ребята!', dateLabel: '4 авг', isAnonymous: false },
  { id: 's4', name: 'Мария С.', amountRub: 1500, message: 'За Джина ❤️', dateLabel: '4 авг', isAnonymous: false },
  { id: 's5', name: 'Ксения', amountRub: 500, message: '', dateLabel: '4 авг', isAnonymous: false },
  { id: 's6', name: 'Аноним', amountRub: 2000, message: '', dateLabel: '3 авг', isAnonymous: true },
  { id: 's7', name: 'Ольга П.', amountRub: 700, message: 'Маленький вклад, но от души 🙏', dateLabel: '3 авг', isAnonymous: false },
  { id: 's8', name: 'Никита', amountRub: 10000, message: 'На новый микрофон! Качество звука очень важно', dateLabel: '2 авг', isAnonymous: false, goalTitle: 'Виниловый проигрыватель Rega Planar 3' },
  { id: 's9', name: 'Вика', amountRub: 300, message: '', dateLabel: '2 авг', isAnonymous: false },
  { id: 's10', name: 'Артём Л.', amountRub: 1000, message: 'Спасибо, что не бросаете проект', dateLabel: '1 авг', isAnonymous: false },
  { id: 's11', name: 'Аноним', amountRub: 1200, message: '', dateLabel: '1 авг', isAnonymous: true },
  { id: 's12', name: 'Екатерина', amountRub: 2500, message: 'Лучшая команда озвучки, обнимаю всех', dateLabel: '31 июл', isAnonymous: false },
  { id: 's13', name: 'Сергей', amountRub: 500, message: '', dateLabel: '31 июл', isAnonymous: false },
  { id: 's14', name: 'Полина', amountRub: 800, message: 'За контент про BTS 💜', dateLabel: '30 июл', isAnonymous: false },
  { id: 's15', name: 'Аноним', amountRub: 3500, message: '', dateLabel: '30 июл', isAnonymous: true },
  { id: 's16', name: 'Роман', amountRub: 1000, message: 'Продолжайте в том же духе!', dateLabel: '29 июл', isAnonymous: false },
  { id: 's17', name: 'Дарья', amountRub: 600, message: '', dateLabel: '29 июл', isAnonymous: false },
  { id: 's18', name: 'Илья', amountRub: 2000, message: 'Поддерживаю от всей души', dateLabel: '28 июл', isAnonymous: false },
]

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })

export default async function DonatePage() {
  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>
  const { tenant, settings } = ctx

  const payload = await getPayload({ config: await config })
  const [goalsRes, paysRes] = await Promise.all([
    payload.find({
      collection: 'support-goals',
      where: { and: [{ tenant: { equals: tenant.id } }, { isActive: { equals: true } }] },
      sort: 'weight', limit: 50, depth: 0, overrideAccess: true,
    }),
    payload.find({
      collection: 'support-payments',
      where: { and: [{ tenant: { equals: tenant.id } }, { status: { equals: 'succeeded' } }] },
      sort: '-createdAt', limit: 200, depth: 1, overrideAccess: true,
    }),
  ])

  const dbGoals: DnGoal[] = (goalsRes.docs as any[]).map((g) => ({
    id: g.id, title: g.title || '', description: g.description || '',
    targetRub: Number(g.targetRub) || 0, raisedRub: Number(g.raisedRub) || 0,
  }))
  const dbPays: DnSupporter[] = (paysRes.docs as any[]).map((p) => {
    const goalObj = p.goal && typeof p.goal === 'object' ? p.goal : null
    return {
      id: p.id,
      name: p.isAnonymous ? 'Аноним' : (p.displayName || 'Аноним'),
      amountRub: Number(p.amountRub) || 0,
      message: p.message || '',
      dateLabel: p.createdAt ? dateFmt.format(new Date(p.createdAt)) : '',
      isAnonymous: !!p.isAnonymous,
      goalTitle: goalObj?.title || undefined,
    }
  })

  const isDemo = dbGoals.length === 0 && dbPays.length === 0
  const goals = dbGoals.length ? dbGoals : DEMO_GOALS
  const supporters = dbPays.length ? dbPays : (dbGoals.length ? [] : DEMO_SUPPORTERS)

  const totalRaisedRub =
    goals.reduce((a, g) => a + g.raisedRub, 0) +
    supporters.filter((s) => !s.goalTitle).reduce((a, s) => a + s.amountRub, 0)
  const supportersCount = supporters.length
  const weekCount = isDemo
    ? 6
    : (paysRes.docs as any[]).filter((p) => p.createdAt && Date.now() - new Date(p.createdAt).getTime() < 7 * 864e5).length

  const appIconM = settings?.appIcon && typeof settings.appIcon === 'object' ? settings.appIcon : null
  const logoM = settings?.logo && typeof settings.logo === 'object' ? settings.logo : null
  const logoUrl = (appIconM?.url as string | undefined) ?? (logoM?.url as string | undefined) ?? null

  return (
    <div style={brandVars(settings) as React.CSSProperties}>
      <DonateView
        brandName={tenant.name ?? ''}
        logoUrl={logoUrl}
        goals={goals}
        supporters={supporters}
        totalRaisedRub={totalRaisedRub}
        supportersCount={supportersCount}
        weekCount={weekCount}
        userName=""
        subscribeHref="/subscribe"
        isDemo={isDemo}
      />
    </div>
  )
}
