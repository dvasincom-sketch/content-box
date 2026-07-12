import type { MetadataRoute } from 'next'
import { headers as getHeaders } from 'next/headers.js'

/**
 * Динамический per-tenant robots.txt (ТЗ §6).
 *
 * Отдаёт правила и ссылку на sitemap текущего домена. Схема и хост берутся
 * из заголовка host запроса, поэтому robots на каждом домене указывает на
 * свой sitemap. Админка и API закрыты от индексации.
 */

export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headers = await getHeaders()
  const host = headers.get('host')

  const proto =
    !host || host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https'
  const base = host ? `${proto}://${host}` : ''

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/my-route'],
      },
    ],
    ...(base ? { sitemap: `${base}/sitemap.xml`, host: base } : {}),
  }
}
