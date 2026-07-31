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

// Прозрачный PNG 1×1 — абсолютный фолбэк без sharp, если даже он недоступен.
// Гарантирует, что роут НИКОГДА не отвечает 502 (иначе в логах/лайтхаусе шум, а в
// установленном PWA битая иконка).
const BLANK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQB8yTX1AAAAAElFTkSuQmCC',
  'base64',
)

/** '#RRGGBB' → {r,g,b}. Для фолбэка без color-парсера sharp (он мог и падать). */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec((hex || '').trim())
  if (!m) return { r: 15, g: 10, b: 30 } // #0F0A1E — тёмный дефолт
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

function png(body: Buffer): Response {
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  })
}

export async function GET(req: NextRequest): Promise<Response> {
  const p = req.nextUrl.searchParams
  const size = Math.min(1024, Math.max(48, parseInt(p.get('size') || '512', 10) || 512))
  const maskable = p.get('maskable') === '1'

  // Фон берём заранее: он нужен и основному пути, и фолбэку. Ошибку контекста/
  // пресета тоже гасим — иконка не должна зависеть от доступности тенанта.
  let bg = '#0F0A1E'
  let fg = '#7C3AED'
  let logoUrl: string | null = null
  let letter = 'C'
  try {
    const ctx = await getTenantFromHeaders()
    const settings = ctx?.settings as any
    const tenant = ctx?.tenant as any
    const preset = getPreset(settings?.themePreset)
    bg = preset.light.bg
    fg = preset.light.primary
    logoUrl = settings?.logo && typeof settings.logo === 'object' ? (settings.logo.url as string) : null
    letter = ((tenant?.name as string) || 'C').trim().charAt(0).toUpperCase() || 'C'
  } catch {
    /* дефолты выше */
  }

  const pad = Math.round(size * (maskable ? 0.1 : 0.06))
  const inner = size - pad * 2

  // Основной путь: логотип тенанта или буквенный знак на брендовом фоне.
  // Любая ошибка sharp/загрузки → фолбэк ниже, но НЕ 502.
  try {
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
      const fontSize = Math.round(inner * 0.6)
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + inner + '" height="' + inner + '">' +
        '<text x="50%" y="50%" dy=".35em" text-anchor="middle" ' +
        'font-family="Arial, Helvetica, sans-serif" font-size="' + fontSize + '" ' +
        'font-weight="700" fill="' + fg + '">' + escapeXml(letter) + '</text></svg>'
      content = await sharp(Buffer.from(svg)).png().toBuffer()
    }

    const out = await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
      .composite([{ input: content, top: pad, left: pad }])
      .png()
      .toBuffer()
    return png(out)
  } catch {
    // Фолбэк 1: сплошной брендовый квадрат — без SVG и без внешних загрузок
    // (частая причина падения — SVG-рендер или color-парсер). RGB считаем сами.
    try {
      const solid = await sharp({
        create: { width: size, height: size, channels: 4, background: { ...hexToRgb(bg), alpha: 1 } },
      })
        .png()
        .toBuffer()
      return png(solid)
    } catch {
      // Фолбэк 2: пустой PNG совсем без sharp. Лишь бы не 502.
      return png(BLANK_PNG)
    }
  }
}
