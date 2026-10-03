import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { isSuperAdmin, getUserTenantID } from '@/access'
import { backfillSeoPage } from '@/lib/seoBackfill'

/**
 * Серверный бэкфилл SEO-описаний для админ-кнопки на /admin/seo-audit. БД
 * доступна с сервера приложения (прод Timeweb закрыт фаерволом по IP — с
 * ноутбука напрямую не подключиться), поэтому генерацию запускаем здесь.
 *
 * Аутентификация — Payload-пользователь (кука админки). Скоуп — тенант этого
 * пользователя; суперадмин может указать tenant в теле. Работаем ОДНОЙ страницей
 * за запрос (клиент идёт страницами) — чтобы не упереться в таймаут.
 *
 * POST { collection: 'categories'|'publications', page?, dry?, force?, tenant? }
 *   → { ok, collection, page, totalPages, scanned, updated, skipped, done }
 */
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config: await config })

  let user: any = null
  try {
    const a = await payload.auth({ headers: req.headers })
    user = a?.user
  } catch { /* нет сессии */ }
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const body: any = await req.json().catch(() => null)
  const collection = body?.collection === 'publications' ? 'publications' : 'categories'
  const page = Math.max(1, Number(body?.page) || 1)
  const dry = body?.dry === true
  const force = body?.force === true

  // Тенант определяем как SeoAuditView: user.tenant / tenants[0].tenant.
  // У суперадмина тенанта НЕТ (platformRole=superadmin) — для него обрабатываем
  // все тенанты (так же, как аудит показывает все категории без фильтра).
  const tenantRel = (user as any)?.tenant ?? (user as any)?.tenants?.[0]?.tenant
  let tenantId: number | string | undefined =
    tenantRel && typeof tenantRel === 'object' ? tenantRel.id : tenantRel
  if (!tenantId) tenantId = getUserTenantID(user) || undefined
  const superadmin = isSuperAdmin(user)
  if (superadmin && body?.tenant) tenantId = Number(body.tenant)
  if (!tenantId && !superadmin) {
    return NextResponse.json({ ok: false, error: 'no_tenant' }, { status: 400 })
  }

  try {
    // tenantId undefined у суперадмина → бэкфилл по всем тенантам.
    const r = await backfillSeoPage(payload, { collection, tenantId: tenantId ?? null, page, limit: 50, dry, force })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || 'backfill_failed' }, { status: 500 })
  }
}
