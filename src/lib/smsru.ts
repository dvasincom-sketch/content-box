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

/**
 * Авторизация ЗВОНКОМ ОТ КЛИЕНТА (sms.ru callcheck): sms.ru выдаёт номер, на
 * который пользователь звонит СО СВОЕГО телефона; система узнаёт его по АОН.
 * Ничего абоненту не звоним/не шлём — звонит он сам, это надёжнее.
 *
 * add → { checkId, callPhone } (номер для звонка), затем опрашиваем status.
 * GET https://sms.ru/callcheck/add?phone=<7XXXXXXXXXX>&api_id=…&json=1
 */
type SmsRuCheckAddResp = {
  status: 'OK' | 'ERROR'
  status_code?: number
  status_text?: string
  check_id?: string | number
  call_phone?: string
  call_phone_pretty?: string
}
export async function callcheckAdd(phone: string): Promise<{ ok: boolean; checkId?: string; callPhone?: string; callPhonePretty?: string; error?: string }> {
  if (!SMSRU_API_ID) return { ok: false, error: 'Авторизация по звонку не настроена' }
  const params = new URLSearchParams({ api_id: SMSRU_API_ID, phone, json: '1' })
  try {
    const res = await fetch(`https://sms.ru/callcheck/add?${params.toString()}`, { method: 'GET', cache: 'no-store' })
    if (!res.ok) return { ok: false, error: `sms.ru HTTP ${res.status}` }
    const data = (await res.json()) as SmsRuCheckAddResp
    if (data.status !== 'OK' || !data.check_id || !data.call_phone) {
      return { ok: false, error: data.status_text || `sms.ru ${data.status_code ?? ''}`.trim() }
    }
    return {
      ok: true,
      checkId: String(data.check_id),
      callPhone: String(data.call_phone),
      callPhonePretty: data.call_phone_pretty ? String(data.call_phone_pretty) : String(data.call_phone),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network' }
  }
}

type SmsRuCheckStatusResp = {
  status: 'OK' | 'ERROR'
  status_code?: number
  status_text?: string
  check_status?: number
  check_status_text?: string
}
/** Статус проверки: 'confirmed' (позвонил), 'waiting' (ждём), 'expired'. */
export async function callcheckStatus(checkId: string): Promise<{ ok: boolean; state?: 'confirmed' | 'waiting' | 'expired'; error?: string }> {
  if (!SMSRU_API_ID) return { ok: false, error: 'Авторизация по звонку не настроена' }
  const params = new URLSearchParams({ api_id: SMSRU_API_ID, check_id: checkId, json: '1' })
  try {
    const res = await fetch(`https://sms.ru/callcheck/status?${params.toString()}`, { method: 'GET', cache: 'no-store' })
    if (!res.ok) return { ok: false, error: `sms.ru HTTP ${res.status}` }
    const data = (await res.json()) as SmsRuCheckStatusResp
    if (data.status !== 'OK') return { ok: false, error: data.status_text || `sms.ru ${data.status_code ?? ''}`.trim() }
    // Код проверки: предпочитаем check_status, иначе — status_code.
    const cs = Number(data.check_status != null ? data.check_status : data.status_code)
    if (cs === 401) return { ok: true, state: 'confirmed' }
    if (cs === 400 || cs === 100) return { ok: true, state: 'waiting' }
    return { ok: true, state: 'expired' } // 402 и прочее — истекло/неверно
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network' }
  }
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
