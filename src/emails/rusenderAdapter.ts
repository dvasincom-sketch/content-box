import type { EmailAdapter, SendEmailOptions } from 'payload'

/**
 * Кастомный почтовый адаптер Payload поверх HTTP-API RuSender.
 *
 * Авторизация сервиса — токеном и ID ключа:
 *   POST {base}/api/v1/external-mails/send/{keyId}
 *   Authorization: Bearer <token>
 *
 * Через этот адаптер идут и письма самого Payload (сброс пароля, verify), и
 * наши шаблоны (payload.sendEmail). Зависимостей нет — используется глобальный
 * fetch (Node 20+). Отправитель должен принадлежать подтверждённому домену ключа.
 */

export type Recipient = { email: string; name?: string }

// "Имя <mail@x>" | "mail@x" | { name, address } → { email, name? }
export function parseAddress(input: unknown): Recipient | null {
  if (!input) return null
  if (typeof input === 'object') {
    const a = input as { name?: string; address?: string }
    return a.address ? { email: a.address, name: a.name || undefined } : null
  }
  const s = String(input).trim()
  if (!s) return null
  // Форма «Имя <mail@x>»
  const angle = s.match(/^(.*)<([^<>\s]+@[^<>\s]+)>$/)
  if (angle) {
    const name = angle[1].replace(/"/g, '').trim()
    return { email: angle[2].trim(), name: name || undefined }
  }
  // Без угловых скобок — весь ввод считаем адресом.
  if (/^[^<>\s]+@[^<>\s]+$/.test(s)) return { email: s }
  return null
}

// to может быть строкой (в т.ч. через запятую), объектом или массивом.
export function toRecipients(to: SendEmailOptions['to']): Recipient[] {
  const out: Recipient[] = []
  const push = (v: unknown) => {
    if (typeof v === 'string') {
      for (const part of v.split(',')) {
        const r = parseAddress(part)
        if (r) out.push(r)
      }
    } else {
      const r = parseAddress(v)
      if (r) out.push(r)
    }
  }
  if (Array.isArray(to)) to.forEach(push)
  else push(to)
  return out
}

export type RusenderAdapterOptions = {
  apiToken?: string
  keyId?: string
  apiBase?: string
  defaultFromAddress?: string
  defaultFromName?: string
}

export const rusenderEmailAdapter = (opts: RusenderAdapterOptions = {}): EmailAdapter => {
  const apiToken = opts.apiToken ?? process.env.RUSENDER_API_TOKEN ?? ''
  const keyId = opts.keyId ?? process.env.RUSENDER_API_KEY_ID ?? ''
  const apiBase = (
    opts.apiBase ??
    process.env.RUSENDER_API_BASE ??
    'https://api.beta.rusender.ru'
  ).replace(/\/+$/, '')
  const defaultFromAddress =
    opts.defaultFromAddress ?? process.env.EMAIL_FROM_ADDRESS ?? 'noreply@contentbox.site'
  const defaultFromName = opts.defaultFromName ?? process.env.EMAIL_FROM_NAME ?? 'Content Box'

  return () => ({
    name: 'rusender',
    defaultFromAddress,
    defaultFromName,
    async sendEmail(message) {
      if (!apiToken || !keyId) {
        throw new Error('RuSender: не заданы RUSENDER_API_TOKEN / RUSENDER_API_KEY_ID')
      }

      const from = parseAddress(message.from) ?? {
        email: defaultFromAddress,
        name: defaultFromName,
      }
      const recipients = toRecipients(message.to)
      if (recipients.length === 0) {
        throw new Error('RuSender: пустой список получателей (to)')
      }

      const url = `${apiBase}/api/v1/external-mails/send/${encodeURIComponent(keyId)}`
      const subject = String(message.subject ?? '')
      const html = typeof message.html === 'string' ? message.html : undefined
      const text = typeof message.text === 'string' ? message.text : undefined

      // RuSender шлёт по одному получателю на запрос — цикл по адресам.
      const results: unknown[] = []
      for (const to of recipients) {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            idempotencyKey: globalThis.crypto?.randomUUID?.(),
            mail: {
              to: { email: to.email, ...(to.name ? { name: to.name } : {}) },
              from: { email: from.email, ...(from.name ? { name: from.name } : {}) },
              subject,
              ...(html ? { html } : {}),
              ...(text ? { text } : {}),
            },
          }),
        })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          throw new Error(`RuSender API ${res.status}: ${body.slice(0, 500)}`)
        }
        results.push(await res.json().catch(() => ({})))
      }
      return results.length === 1 ? results[0] : results
    },
  })
}
