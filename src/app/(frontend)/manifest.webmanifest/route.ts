import { getTenantFromHeaders } from '@/lib/tenant'
import { getPreset } from '@/lib/themePresets'

/**
 * Динамический web app manifest НА КАЖДЫЙ ТЕНАНТ. Тенант определяется по хосту
 * (x-tenant-id из proxy.ts). Имя/иконки/цвета берутся из тенанта и его пресета,
 * поэтому каждый фансайт ставится как отдельное приложение со своим брендом.
 */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const ctx = await getTenantFromHeaders()
  const tenant = ctx?.tenant as any
  const settings = ctx?.settings as any
  const preset = getPreset(settings?.themePreset)
  const bg = preset.light.bg

  const name = (tenant?.name && String(tenant.name).trim()) || 'Content Box'
  const shortName = name.length > 12 ? name.slice(0, 12) : name
  const description =
    tenant?.description && String(tenant.description).trim()
      ? String(tenant.description).trim()
      : undefined

  const manifest = {
    name,
    short_name: shortName,
    description,
    lang: 'ru',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: bg,
    theme_color: bg,
    icons: [
      { src: '/pwa-icon?size=192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon?size=512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon?size=512&maskable=1', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
