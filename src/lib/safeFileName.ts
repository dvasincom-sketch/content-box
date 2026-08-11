/**
 * Чистим имя загружаемого файла: убираем эмодзи и спецсимволы — из-за них ключ
 * объекта в S3-хранилище ломался, и файл потом не открывался (битая картинка /
 * недоступный файл). Оставляем буквы (в т.ч. кириллицу), цифры, дефис и
 * подчёркивание. Расширение сохраняем; если его нет — выводим из mime
 * (картинки/аудио). Общий хелпер для всех аплоад-роутов студии.
 */
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'image/avif': 'avif', 'image/svg+xml': 'svg',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav',
  'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'weba', 'audio/flac': 'flac',
}

export function sanitizeFilename(raw: string, opts: { mime?: string; fallbackBase?: string } = {}): string {
  const str = String(raw || '')
  const dot = str.lastIndexOf('.')
  const rawBase = dot > 0 ? str.slice(0, dot) : str
  let base = rawBase
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\-_ ]+/gu, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  if (!base) base = `${opts.fallbackBase || 'file'}-${Date.now()}`
  let ext = dot > 0 ? str.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) : ''
  if (!ext && opts.mime && MIME_EXT[opts.mime]) ext = MIME_EXT[opts.mime]
  return ext ? `${base}.${ext}` : base
}
