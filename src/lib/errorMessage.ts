/**
 * Текст ошибки из неизвестного значения.
 *
 * В `catch` TypeScript даёт `unknown` — это правильно, бросить можно что
 * угодно. По коду вместо этого стояло `catch (e: any)` и `e?.message` (69 мест):
 * компилятор переставал проверять что бы то ни было, а если бросали строку или
 * объект без `message`, в ответ уходило `undefined` и пользователь видел пустое
 * сообщение.
 *
 * @param fallback что показать, если извлечь текст не удалось.
 */
export function errorMessage(e: unknown, fallback = 'Неизвестная ошибка'): string {
  if (e instanceof Error && e.message) return e.message
  if (typeof e === 'string' && e) return e
  if (e && typeof e === 'object') {
    const m = (e as { message?: unknown }).message
    if (typeof m === 'string' && m) return m
  }
  return fallback
}
