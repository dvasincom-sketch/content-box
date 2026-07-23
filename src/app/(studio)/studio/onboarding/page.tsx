import React from 'react'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'
import { OnboardingWizard } from './OnboardingWizard'

/**
 * Мастер онбординга (/studio/onboarding). Сибling (app)/(auth) — своя оболочка
 * без сайдбара студии, поэтому гейт (app)/layout не зацикливается.
 *
 * Guard: нет автора → на /studio/login; онбординг уже завершён → на /studio.
 * Начальное состояние (включая onboardingStep) отдаём клиентскому мастеру для
 * возобновления.
 */
export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const author = await getCurrentAuthor()
  if (!author) redirect('/studio/login')

  const payload = await getPayload({ config: await config })
  const tenant = await payload
    .findByID({ collection: 'tenants', id: author.tenantId, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!tenant) redirect('/studio/login')
  if ((tenant as any).onboardingComplete) redirect('/studio')

  const settingsRes = await payload.find({
    collection: 'site-settings',
    where: { tenant: { equals: author.tenantId } },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })
  const settings = settingsRes.docs[0] as any
  const logoUrl =
    settings?.logo && typeof settings.logo === 'object' ? settings.logo.url : null

  const t = tenant as any
  // Имя тенанта при регистрации — временный плейсхолдер; в поле показываем пусто,
  // чтобы автор ввёл реальное название проекта.
  const displayName = t.name && t.name !== 'Новый проект' ? t.name : ''
  const initial = {
    name: displayName,
    description: t.description || '',
    subdomain: t.subdomain || '',
    category: t.category || '',
    step: Number(t.onboardingStep) || 0,
    logoUrl: logoUrl as string | null,
  }

  return <OnboardingWizard initial={initial} email={author.user.email} />
}
