import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { sameHost } from '@/lib/digestTracking'

export const dynamic = 'force-dynamic'

/**
 * Кликовый редирект дайджеста: `/api/n/c/:issueId?u=<url>`. Инкрементит `clicks`
 * выпуска и делает 302 на исходный адрес. Защита от open-redirect: редиректим
 * ТОЛЬКО если хост цели совпадает с доменом тенанта этого выпуска; иначе — на
 * главную тенанта (или origin запроса).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params
  const id = Number(issueId)
  const reqUrl = new URL(req.url)
  const target = reqUrl.searchParams.get('u') || ''

  let payload: Awaited<ReturnType<typeof getPayload>> | null = null
  let issue: any = null
  if (Number.isFinite(id) && id > 0) {
    try {
      payload = await getPayload({ config: await config })
      issue = await payload.findByID({
        collection: 'digest-issues' as any,
        id,
        depth: 1,
        overrideAccess: true,
      })
    } catch {
      issue = null
    }
  }

  const tenant = issue?.tenant
  const domain = tenant && typeof tenant === 'object' ? String(tenant.domain || '') : ''
  const home = domain ? `https://${domain}` : reqUrl.origin

  let dest = home
  if (target && /^https?:\/\//i.test(target) && domain && sameHost(target, `https://${domain}`)) {
    dest = target
  }

  if (payload && issue) {
    try {
      await payload.update({
        collection: 'digest-issues' as any,
        id,
        data: { clicks: (Number(issue.clicks) || 0) + 1 } as any,
        overrideAccess: true,
      })
    } catch {
      // клик не критичен — редирект всё равно сделаем
    }
  }

  return NextResponse.redirect(dest, 302)
}
