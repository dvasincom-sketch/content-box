import { withAuthor, readJson, apiError, apiOk, belongsToTenant } from '@/app/(studio)/studio/api/_lib'
import { htmlToLexical } from '@/lib/lexical'

/**
 * Обновление страницы из конструктора меню (панель редактирования).
 * Фокусная правка: заголовок + содержимое (HTML из RichEditor → Lexical).
 * slug/seo здесь не меняются (смена slug ломает ссылки — отдельный сценарий).
 *
 * Body: { id, title?, content? }  (content — HTML-строка из RichEditor)
 */
export const POST = withAuthor(async ({ req, payload, tenantId }) => {
  const data = await readJson(req)
  if (data === undefined) return apiError('Некорректный запрос')

  const id = data.id
  if (!id) return apiError('Не указана страница')

  // Страница принадлежит тенанту?
  const own = await belongsToTenant(payload, 'pages', id, tenantId)
  if (!own) return apiError('Страница не найдена', 404)

  const patch: any = {}

  if (typeof data.title === 'string') {
    const t = data.title.trim()
    if (!t) return apiError('Заголовок не может быть пустым')
    patch.title = t
  }

  // Содержимое: HTML из редактора → Lexical (как у категорий/постов).
  if (typeof data.content === 'string') {
    patch.content = htmlToLexical(data.content)
  }

  if (Object.keys(patch).length === 0) {
    return apiError('Нет изменений')
  }

  try {
    await payload.update({
      collection: 'pages',
      id,
      data: patch,
      overrideAccess: true,
    })
    return apiOk()
  } catch (e: any) {
    return apiError(e?.message || 'Не удалось сохранить')
  }
})
