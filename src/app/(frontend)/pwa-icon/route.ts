import type { NextRequest } from 'next/server'
import sharp from 'sharp'
import { getTenantFromHeaders } from '@/lib/tenant'
import { getPreset } from '@/lib/themePresets'

/**
 * PWA-иконка на тенанта. Если у тенанта есть логотип — кладём его по центру на
 * брендовый фон; иначе рисуем буквенный знак (первая буква названия). Отдаём PNG
 * нужного размера; maskable=1 добавляет safe-zone отступ под адаптивные иконки.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string),
  )
}

export async function GET(req: NextRequest): Promise<Response> {
  const p = req.nextUrl.searchParams
  const size = Math.min(1024, Math.max(48, parseInt(p.get('size') || '512', 10) || 512))
  const maskable = p.get('maskable') === '1'

  const ctx = await getTenantFromHeaders()
  const settings = ctx?.settings as any
  const tenant = ctx?.tenant as any
  const preset = getPreset(settings?.themePreset)
  const bg = preset.light.bg
  const fg = preset.light.primary

  const pad = Math.round(size * (maskable ? 0.1 : 0.06))
  const inner = size - pad * 2

  const logoUrl =
    settings?.logo && typeof settings.logo === 'object' ? (settings.logo.url as string) : null

  let content: Buffer | null = null
  if (logoUrl) {
    try {
      const res = await fetch(logoUrl)
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer())
        content = await sharp(buf)
          .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer()
      }
    } catch {
      /* упадём на буквенный знак ниже */
    }
  }

  if (!content) {
    const letter = ((tenant?.name as string) || 'C').trim().charAt(0).toUpperCase() || 'C'
    const fontSize = Math.round(inner * 0.6)
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + inner + '" height="' + inner + '">' +
      '<text x="50%" y="50%" dy=".35em" text-anchor="middle" ' +
      'font-family="Arial, Helvetica, sans-serif" font-size="' + fontSize + '" ' +
      'font-weight="700" fill="' + fg + '">' + escapeXml(letter) + '</text></svg>'
    content = await sharp(Buffer.from(svg)).png().toBuffer()
  }

  const png = await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: content, top: pad, left: pad }])
    .png()
    .toBuffer()

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  })
}
