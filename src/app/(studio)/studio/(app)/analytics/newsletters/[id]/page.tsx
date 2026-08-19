import React from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { ArrowLeft, Mail } from 'lucide-react'
import { requireAuthor } from '@/lib/currentAuthor'

export const dynamic = 'force-dynamic'

/**
 * Студия → Аналитика → Рассылки → Выпуск (owner-only, read-only).
 * Показывает само письмо, которое ушло подписчикам (сохранённое тело выпуска
 * digest-issues), в изолированном iframe. Доступ — только владелец и только к
 * выпускам своего тенанта.
 */
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: 'long', year: 'numeric' })
  } catch {
    return ''
  }
}

export default async function NewsletterIssue({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const author = await requireAuthor()
  const isOwner = (author!.user as { tenantRole?: string | null }).tenantRole !== 'contributor'
  if (!isOwner) redirect('/studio')

  const payload = await getPayload({ config: await config })
  const issue = (await payload
    .findByID({ collection: 'digest-issues' as any, id: Number(id), depth: 0, overrideAccess: true })
    .catch(() => null)) as any
  if (!issue || String(issue.tenant) !== String(author!.tenantId)) notFound()

  const subject = String(issue.subject || 'Выпуск дайджеста')
  const sentAt = String(issue.sentAt || issue.createdAt || '')
  const body = String(issue.html || '')

  return (
    <>
      <div className="studio-page-head">
        <div>
          <Link href="/studio/analytics/newsletters" style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem', textDecoration: 'none', color: 'var(--st-text-muted)', fontSize: '.9rem' }}>
            <ArrowLeft size={15} /> К рассылкам
          </Link>
          <h1 style={{ marginTop: '.4rem' }}>{subject}</h1>
          {sentAt ? <div className="studio-page-head__sub">Отправлено {fmtDate(sentAt)}</div> : null}
        </div>
      </div>

      <div style={{ maxWidth: 720 }}>
        <div className="nl-policy" style={{ marginBottom: '1rem' }}>
          <Mail size={18} />
          <span>Так письмо выглядело в почте у ваших подписчиков.</span>
        </div>
        <section className="studio-card" style={{ padding: 0, overflow: 'hidden' }}>
          <iframe
            title={subject}
            srcDoc={body}
            sandbox=""
            style={{ width: '100%', minHeight: '70vh', border: 0, background: '#fff', display: 'block' }}
          />
        </section>
      </div>
    </>
  )
}
