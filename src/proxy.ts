import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Domain → tenant resolution (ТЗ §5).
 *
 * Runs on every front-end request. Reads the hostname, looks up an ACTIVE +
 * domainVerified Tenant by `domain` via Payload's REST API, and injects the
 * tenant context into request headers so rendering and Payload queries operate
 * in that scope. ISR/CDN cache is varied by domain so tenants never share HTML.
 *
 * Place this file at: src/middleware.ts
 */

const BYPASS_PREFIXES = ['/admin', '/api', '/_next', '/favicon.ico']

function stripPort(host: string | null): string {
  return (host || '').split(':')[0].toLowerCase()
}

async function resolveTenantByDomain(domain: string, origin: string) {
  const qs = new URLSearchParams({
    'where[and][0][domain][equals]': domain,
    'where[and][1][status][equals]': 'active',
    'where[and][2][domainVerified][equals]': 'true',
    limit: '1',
    depth: '0',
  })
  const url = `${origin}/api/tenants?${qs.toString()}`
  try {
    const res = await fetch(url, {
      headers: { 'content-type': 'application/json' },
      next: { revalidate: 60, tags: [`tenant:${domain}`] },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.docs?.[0] || null
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (BYPASS_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const host = stripPort(
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.hostname,
  )
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = `${proto}://${host}`
  console.log('[proxy] host=', host, '| origin=', origin)
  const tenant = await resolveTenantByDomain(host, origin)

  if (!tenant) {
    // Unknown / unverified / suspended domain → don't leak another tenant.
    const url = request.nextUrl.clone()
    url.pathname = '/domain-not-found'
    const res = NextResponse.rewrite(url)
    res.headers.set('x-tenant-status', 'unresolved')
    return res
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant-id', String(tenant.id))
  requestHeaders.set('x-tenant-domain', host)

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set('x-tenant-id', String(tenant.id))
  res.headers.set('x-tenant-domain', host)
  res.headers.set('Vary', 'x-tenant-domain')
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
