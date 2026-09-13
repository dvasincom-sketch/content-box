import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentSubscriber } from '@/lib/currentSubscriber'
import { readTrusted, TRUSTED_COOKIE } from '@/lib/trustedDevice'
import { tenantIdByHost } from '@/lib/tenantByHost'
import { LoginForm } from './LoginForm'

/**
 * Вход подписчика. Серверная обёртка: если сессия уже валидна, НЕ показываем
 * форму входа (иначе выходит противоречие — в шапке пользователь «вошёл», а
 * страница просит войти). Отправляем на нужную страницу (?redirect=…, только
 * внутренний путь) или на главную. Саму форму рендерит клиентский LoginForm.
 *
 * Дополнительно: если сессия слетела/истекла, но браузер ещё помнит устройство
 * (кука `cb_td`), достаём из неё аккаунт и отдаём форме замаскированный номер —
 * чтобы предложить вход одним кликом «Продолжить как …», без ввода телефона и
 * без SMS (см. /api/auth/phone/continue).
 */
export const dynamic = 'force-dynamic'

function safeRedirect(v: string | string[] | undefined): string {
  const s = typeof v === 'string' ? v : ''
  return s.startsWith('/') && !s.startsWith('//') ? s : '/'
}

/** +7 (916) •••-••-69 — код региона и две последние цифры для узнавания. */
function maskPhone(normalized: string): string {
  const d = (normalized || '').replace(/\D/g, '')
  if (d.length !== 11) return ''
  const p = d.slice(1)
  return `+7 (${p.slice(0, 3)}) •••-••-${p.slice(8, 10)}`
}

/** Запомненный на этом устройстве аккаунт (или null), если ещё существует. */
async function rememberedDevice(): Promise<string | null> {
  const h = await headers()
  let tenantId = h.get('x-tenant-id')
  if (!tenantId) {
    const host = h.get('x-forwarded-host') || h.get('host') || ''
    tenantId = await tenantIdByHost(host).catch(() => null)
  }
  if (!tenantId) return null

  const c = await cookies()
  const trusted = readTrusted(c.get(TRUSTED_COOKIE)?.value, tenantId)
  if (!trusted) return null

  // Предлагаем аккаунт только если он ещё существует в этом тенанте.
  const payload = await getPayload({ config: await config })
  const found = await payload.find({
    collection: 'subscribers',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { id: { equals: trusted.subscriberId } },
        { phone: { equals: trusted.phone } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (found.docs.length === 0) return null

  return maskPhone(trusted.phone) || null
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sub = await getCurrentSubscriber().catch(() => null)
  if (sub) {
    const sp = await searchParams
    redirect(safeRedirect(sp?.redirect))
  }
  const remembered = await rememberedDevice().catch(() => null)
  return <LoginForm remembered={remembered} />
}
