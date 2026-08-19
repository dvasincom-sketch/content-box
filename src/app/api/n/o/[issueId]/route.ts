import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { TRACKING_GIF } from '@/lib/digestTracking'

export const dynamic = 'force-dynamic'

/**
 * Пиксель открытия дайджеста: `/api/n/o/:issueId`. Инкрементит `opens` выпуска и
 * всегда отдаёт прозрачный 1×1 gif (трекинг не должен ломать показ письма).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params
  const id = Number(issueId)
  if (Number.isFinite(id) && id > 0) {
    try {
      const payload = await getPayload({ config: await config })
      const doc = (await payload.findByID({
        collection: 'digest-issues' as any,
        id,
        depth: 0,
        overrideAccess: true,
      })) as any
      if (doc) {
        await payload.update({
          collection: 'digest-issues' as any,
          id,
          data: { opens: (Number(doc.opens) || 0) + 1 } as any,
          overrideAccess: true,
        })
      }
    } catch {
      // молча: пиксель всё равно отдадим
    }
  }
  return new NextResponse(new Uint8Array(TRACKING_GIF), {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(TRACKING_GIF.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
    },
  })
}
