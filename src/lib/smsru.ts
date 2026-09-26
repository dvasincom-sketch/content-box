/**
 * Клиент sms.ru для отправки кода входа. Ключ — `SMSRU_API_ID` (env, серверный).
 * Пока ключ не задан — no-op с ошибкой (роут вернёт «отправка недоступна»),
 * приложение не падает.
 *
 * Мы генерим и проверяем код сами (см. роуты auth/phone), а sms.ru используем
 * только как транспорт обычной SMS: POST https://sms.ru/sms/send (json=1).
 */
export const SMSRU_API_ID = (process.env.SMSRU_API_ID || '').trim()
export const SMSRU_FROM = (process.env.SMSRU_FROM || '').trim() // опциональное имя отправителя

export function smsEnabled(): boolean {
  return SMSRU_API_ID.length > 0
}

/** Доступно ли подтверждение по звонку (тот же ключ sms.ru). */
export function callEnabled(): boolean {
  return SMSRU_API_ID.length > 0
}

type SmsRuCallResp = {
  status: 'OK' | 'ERROR'
  status_code?: number
  status_text?: string
  code?: string | number
  call_id?: string
  cost?: number
  balance?: number
}

/**
 * Подтверждение по ЗВОНКУ (sms.ru «code/call»): провайдер звонит на номер,
 * последние 4 цифры входящего номера — это и есть код. sms.ru возвращает его
 * в ответе; мы храним и сверяем с тем, что ввёл пользователь. SMS не шлём.
 * GET https://sms.ru/code/call?phone=<7XXXXXXXXXX>&ip=-1&api_id=…&json=1
 */
export async function callCode(phone: string): Promise<{ ok: boolean; code?: string; error?: string }> {
  if (!SMSRU_API_ID) return { ok: false, error: 'Подтверждение по звонку не настроено' }
  const params = new URLSearchParams({ api_id: SMSRU_API_ID, phone, ip: '-1', json: '1' })
  try {
    const res = await fetch(`https://sms.ru/code/call?${params.toString()}`, { method: 'GET', cache: 'no-store' })
    if (!res.ok) return { ok: false, error: `sms.ru HTTP ${res.status}` }
    const data = (await res.json()) as SmsRuCallResp
    if (data.status !== 'OK' || data.code == null || String(data.code).length === 0) {
      return { ok: false, error: data.status_text || `sms.ru ${data.status_code ?? ''}`.trim() }
    }
    return { ok: true, code: String(data.code) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network' }
  }
}

type SmsRuSendResp = {
  status: 'OK' | 'ERROR'
  status_code: number
  status_text?: string
  sms?: Record<string, { status: string; status_code: number; status_text?: string; sms_id?: string }>
  balance?: number
}

/** Отправка одной SMS. Возвращает {ok} или {ok:false, error}. */
export async function sendSms(phone: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!SMSRU_API_ID) return { ok: false, error: 'SMS-отправка не настроена' }
  const params = new URLSearchParams({ api_id: SMSRU_API_ID, to: phone, msg: text, json: '1' })
  if (SMSRU_FROM) params.set('from', SMSRU_FROM)
  try {
    const res = await fetch('https://sms.ru/sms/send', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, error: `sms.ru HTTP ${res.status}` }
    const data = (await res.json()) as SmsRuSendResp
    if (data.status !== 'OK') return { ok: false, error: data.status_text || `sms.ru ${data.status_code}` }
    const per = data.sms?.[phone]
    if (per && per.status !== 'OK') return { ok: false, error: per.status_text || `sms.ru ${per.status_code}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network' }
  }
}
