import sharp from 'sharp'
import { sanitizeFilename } from './safeFileName'

/**
 * Приём изображений в хранилище с экономией места:
 *  1) shrinkForWeb — НЕ храним тяжёлый оригинал. Ужимаем на входе до разумного
 *     максимума по стороне и перекодируем в WebP. Пользователь может загрузить
 *     10–20 МБ JPEG, но на сайт всё равно идут только webp-размеры, поэтому
 *     хранить исходник смысла нет. Векторные (svg) и анимированные (gif) не
 *     трогаем. Payload дальше сам генерит thumbnail/large из этого файла.
 *  2) storageName — добавляет к имени объекта ПРЕФИКС ТЕНАНТА `t<id>-`, чтобы
 *     объекты в бакете группировались по тенанту (замер, lifecycle по префиксу,
 *     безопасная чистка).
 */

// Максимальная длинная сторона хранимого «оригинала». 2560 достаточно для
// ретины и лайтбокса; больше на веб не нужно.
const MAX_DIM = 2560

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/avif': 'avif', 'image/gif': 'gif', 'image/svg+xml': 'svg',
}
export function extFromMime(mime: string): string {
  return EXT[mime] || 'bin'
}

export async function shrinkForWeb(buffer: Buffer, mime: string): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  // Векторные и анимированные форматы оставляем как есть.
  if (mime === 'image/svg+xml' || mime === 'image/gif') return { buffer, mime, ext: extFromMime(mime) }
  try {
    // .rotate() применяет EXIF-ориентацию до ресайза; повторное кодирование в
    // webp попутно вычищает EXIF (в т.ч. геометки) — это ещё и приватность.
    const src = sharp(buffer, { failOn: 'none' }).rotate()
    const meta = await src.metadata()
    const tooBig = (meta.width || 0) > MAX_DIM || (meta.height || 0) > MAX_DIM
    const pipe = tooBig
      ? src.resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
      : src
    const out = await pipe.webp({ quality: 82 }).toBuffer()
    // Берём webp только если он реально меньше — иначе нет смысла.
    if (out.length < buffer.length) return { buffer: out, mime: 'image/webp', ext: 'webp' }
    return { buffer, mime, ext: extFromMime(mime) }
  } catch {
    return { buffer, mime, ext: extFromMime(mime) }
  }
}

export function storageName(tenantId: number | string, raw: unknown, ext: string, fallbackBase = 'img'): string {
  const clean = sanitizeFilename(String(raw || ''), { fallbackBase })
  const base = clean.replace(/\.[^.]*$/, '') || fallbackBase
  return `t${tenantId}-${base}.${ext}`
}
