import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getCurrentAuthor } from '@/lib/currentAuthor'

/**
 * Список категорий тенанта для селектов в студии (напр. «категория-ссылка»
 * участника в редакторе heroTeam). Плоский список { id, title }.
 *
 * Ответ: { ok, categories: [{ id, title }] } | { error }
 */

export async function GET() {
  const author = await getCurrentAuthor()
  if (!author) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await getPayload({ config: await config })

  const res = await payload.find({
    collection: 'categories',
    where: { tenant: { equals: author.tenantId } },
    sort: 'title',
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  const categories = (res.docs as any[]).map((c) => ({
    id: c.id,
    title: c.title ?? '',
  }))

  return NextResponse.json({ ok: true, categories })
}
