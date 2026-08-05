import { NextResponse, type NextRequest } from 'next/server'
import { checkDownloadAccess } from '@/lib/downloadAccess'
import { tenantIdFromRequestHeaders } from '@/lib/tenantByHost'

/**
 * Защищённая отдача файла («Файлы»/downloads). Прямой URL объекта в S3 на сайт
 * не публикуется — скачивание идёт только сюда. Сначала гейтинг по подписке
 * (checkDownloadAccess), затем сервер сам читает объект из хранилища и стримит
 * его клиенту. Адрес в бакете клиенту не виден.
 *
 * Нет доступа → редирект на /subscribe (для платного) или /login (гость),
 * чтобы клик по заблокированной кнопке вёл в точку продажи, а не в тупик JSON.
 *
 * GET /api/download/<id>
 */
export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'Не указан файл' }, { status: 400 })

  const tenantId = await tenantIdFromRequestHeaders(req.headers)
  if (!tenantId) return NextResponse.json({ error: 'Неизвестный домен' }, { status: 404 })

  const access = await checkDownloadAccess({ id, tenantId })

  if (!access.allowed) {
    if (access.reason === 'not-found') {
      return NextResponse.json({ error: 'Файл не найден' }, { status: 404 })
    }
    // Точка продажи вместо тупика.
    const to = access.reason === 'need-login' ? '/login' : '/subscribe'
    return NextResponse.redirect(new URL(to, req.nextUrl.origin), { status: 302 })
  }

  const doc = access.doc
  const url = String(doc?.url || '')
  if (!url.startsWith('http')) {
    return NextResponse.json({ error: 'У файла нет вложения' }, { status: 400 })
  }

  // Читаем объект из хранилища на стороне сервера и стримим клиенту.
  let upstream: Response
  try {
    upstream = await fetch(url)
  } catch {
    return NextResponse.json({ error: 'Хранилище недоступно' }, { status: 502 })
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Файл недоступен в хранилище' }, { status: 502 })
  }

  // Имя для сохранения: осмысленное (по названию + расширение), с поддержкой
  // кириллицы через filename* (RFC 5987). ASCII-fallback — тоже даём.
  const origName = String(doc?.filename || '')
  const ext = origName.includes('.') ? origName.slice(origName.lastIndexOf('.')) : ''
  const base = String(doc?.title || 'file').trim().replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim() || 'file'
  const niceName = ext && !base.toLowerCase().endsWith(ext.toLowerCase()) ? `${base}${ext}` : base
  const asciiName = niceName.replace(/[^\x20-\x7E]+/g, '_') || 'download'
  const encoded = encodeURIComponent(niceName)

  const headers = new Headers()
  headers.set('Content-Type', String(doc?.mimeType || upstream.headers.get('content-type') || 'application/octet-stream'))
  const len = upstream.headers.get('content-length') || (doc?.filesize != null ? String(doc.filesize) : '')
  if (len) headers.set('Content-Length', len)
  headers.set('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`)
  // Не кэшировать у промежуточных прокси — контент под гейтингом.
  headers.set('Cache-Control', 'private, no-store')

  return new NextResponse(upstream.body, { status: 200, headers })
}
