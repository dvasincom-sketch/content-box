import type { Payload, CollectionConfig } from 'payload'
import { getFieldsToSign, jwtSign, generatePayloadCookie } from 'payload'

/**
 * Пассворлесс-сессия автора (коллекция users): тот же JWT-куки, что и
 * /api/users/login, но без пароля — после подтверждения SMS-кода. У users
 * useSessions=false (stateless JWT), поэтому запись сессии не нужна: просто
 * подписываем токен тем же секретом и ставим payload-куку.
 */
export async function buildUserSessionCookie(payload: Payload, userId: string | number): Promise<string> {
  const collectionConfig = payload.collections['users'].config
  const authConfig = collectionConfig.auth
  const user = (await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
  })) as unknown as { id: string | number; email: string }

  const fieldsToSign = getFieldsToSign({
    collectionConfig: collectionConfig as unknown as CollectionConfig,
    email: user.email,
    user: user as never,
    sid: undefined,
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
