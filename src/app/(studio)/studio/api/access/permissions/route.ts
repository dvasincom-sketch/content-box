import { withAuthor, readJson, apiError, apiOk, isContributor } from '@/app/(studio)/studio/api/_lib'
import { logActivity } from '@/lib/logActivity'
import { errorMessage } from '@/lib/errorMessage'
import { PRESETS, PRESET_LABELS, normalize } from '@/lib/permissions'
import type { CapMatrix } from '@/lib/permissions'

const KNOWN_ROLES = new Set([...Object.keys(PRESETS), 'custom'])

/**
 * Сохранение прав участника (studioRole + capabilities). Только владелец студии.
 * Нельзя менять владельца, себя и участника другого тенанта. Если передан
 * известный пресет без своей матрицы — берём матрицу пресета.
 * Body: { userId, studioRole, capabilities? }
 */
export const POST = withAuthor(async ({ req, payload, tenantId, author }) => {
  if (isContributor(author)) return apiError('Доступно только владельцу студии', 403)
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const userId = (data as { userId?: unknown }).userId
  if (!userId) return apiError('Не указан участник')
  if (Number(userId) === Number(author.user.id)) return apiError('Нельзя менять свои права')

  const studioRole = String((data as { studioRole?: unknown }).studioRole || 'custom')
  if (!KNOWN_ROLES.has(studioRole)) return apiError('Неизвестная роль')
  if (studioRole === 'owner') return apiError('Роль «Владелец» назначить нельзя')

  const target: any = await payload
    .findByID({ collection: 'users', id: userId as string | number, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!target) return apiError('Участник не найден', 404)
  const tTenant = target.tenant && typeof target.tenant === 'object' ? target.tenant.id : target.tenant
  if (Number(tTenant) !== Number(tenantId)) return apiError('Участник не найден', 404)
  if (target.tenantRole !== 'contributor') return apiError('Права можно настраивать только у приглашённых участников')

  // Матрица: своя (если передана) или из пресета. Нормализуем (только true).
  const rawCaps = (data as { capabilities?: unknown }).capabilities
  const caps: CapMatrix = rawCaps && typeof rawCaps === 'object' ? (rawCaps as CapMatrix) : (PRESETS[studioRole] ?? {})

  try {
    await payload.update({
      collection: 'users',
      id: userId as string | number,
      data: { studioRole, capabilities: normalize(caps) } as any,
      overrideAccess: true,
    })
    await logActivity(payload, {
      tenant: tenantId, user: author.user.id, action: 'update', entity: 'доступ',
      title: `Права: ${PRESET_LABELS[studioRole] ?? studioRole}`,
    })
    return apiOk()
  } catch (e: unknown) {
    return apiError(errorMessage(e, 'Не удалось сохранить права'))
  }
})
