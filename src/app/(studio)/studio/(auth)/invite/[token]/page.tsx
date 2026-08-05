import crypto from 'crypto'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { AcceptInviteForm } from './AcceptInviteForm'

/**
 * Приём приглашения участника по одноразовой ссылке /studio/invite/<token>.
 * Публичная страница (группа (auth), без сессии). Проверяем токен на сервере,
 * показываем форму установки пароля либо сообщение о недействительной ссылке.
 */
export const dynamic = 'force-dynamic'

export default async function InviteAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const payload = await getPayload({ config: await config })
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const res = await payload.find({
    collection: 'users', where: { inviteTokenHash: { equals: hash } }, limit: 1, depth: 0, overrideAccess: true,
  })
  const u = res.docs[0] as any
  const valid = u && !u.inviteAcceptedAt && u.inviteExpiresAt && new Date(u.inviteExpiresAt).getTime() > Date.now()

  if (!valid) {
    return (
      <div className="studio-login">
        <div className="studio-login__bg" aria-hidden><span className="studio-login__grid" /></div>
        <div className="studio-login__card">
          <div className="studio-login__head">
            <h1>Ссылка недействительна</h1>
            <p>Приглашение устарело или уже использовано. Попросите владельца студии выслать новую ссылку.</p>
          </div>
          <Link href="/studio/login" className="studio-btn studio-btn--primary" style={{ justifyContent: 'center' }}>
            На страницу входа
          </Link>
        </div>
      </div>
    )
  }

  return <AcceptInviteForm token={token} email={String(u.email)} />
}
