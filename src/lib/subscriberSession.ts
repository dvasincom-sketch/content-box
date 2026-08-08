import type { Payload, CollectionConfig } from 'payload'
import { getFieldsToSign, jwtSign, generatePayloadCookie, createLocalReq } from 'payload'
import { v4 as uuid } from 'uuid'

/**
 * Пассворлесс-сессия подписчика: минтим тот же JWT-куки, что и обычный
 * /api/subscribers/login, но без пароля — после подтверждения SMS-кода.
 * Повторяет loginOperation Payload 3.85: при useSessions создаём запись
 * сессии на пользователе и подписываем токен тем же секретом и sid.
 */
export async function buildSubscriberSessionCookie(
  payload: Payload,
  subscriberId: string | number,
): Promise<string> {
  const collectionConfig = payload.collections['subscribers'].config
  const authConfig = collectionConfig.auth

  type UserWithSessions = {
    id: string | number
    email: string
    sessions?: Array<{ id: string; createdAt: Date; expiresAt: Date }>
    [k: string]: unknown
  }
  const user = (await payload.findByID({
    collection: 'subscribers',
    id: subscriberId,
    depth: 0,
    overrideAccess: true,
  })) as unknown as UserWithSessions

  let sid: string | undefined
  if (authConfig.useSessions) {
    sid = uuid()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + authConfig.tokenExpiration * 1000)
    const prior = Array.isArray(user.sessions)
      ? user.sessions.filter((s) => new Date(s.expiresAt) > now)
      : []
    const sessions = [...prior, { id: sid, createdAt: now, expiresAt }]
    const req = await createLocalReq({}, payload)
    await payload.db.updateOne({
      collection: 'subscribers',
      id: user.id,
      data: { ...user, sessions, updatedAt: null } as never,
      req,
      returning: false,
    })
    user.sessions = sessions
  }

  const fieldsToSign = getFieldsToSign({
    collectionConfig: collectionConfig as unknown as CollectionConfig,
    email: user.email,
    user: user as never,
    sid,
  })
  const { token } = await jwtSign({
    fieldsToSign,
    secret: payload.secret,
    tokenExpiration: authConfig.tokenExpiration,
  })
  return generatePayloadCookie({
    collectionAuthConfig: authConfig,
    cookiePrefix: payload.config.cookiePrefix || 'payload',
    token,
  })
}
